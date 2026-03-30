import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Loader2, ChevronRight, ChevronLeft, Upload, FileText, Bot, Plus, Trash2, Edit2, Check, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '@/stores/settingsStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatProvider {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  supportedFileTypes: string[];
}

export interface Agent {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  data: string;
  mimeType: string;
  textContent?: string;
}

const DEFAULT_PROVIDERS: ChatProvider[] = [
  {
    id: 'google',
    name: 'Google AI',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash',
    supportedFileTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'audio/mp3', 'audio/wav', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
];

const AGENTS_STORAGE_KEY = '分镜助手_agents';

function loadAgentsFromStorage(): Agent[] {
  try {
    const stored = localStorage.getItem(AGENTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load agents from storage:', e);
  }
  return [];
}

function saveAgentsToStorage(agents: Agent[]): void {
  try {
    localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(agents));
  } catch (e) {
    console.error('Failed to save agents to storage:', e);
  }
}

async function parseDocxAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const textContent = new TextDecoder('utf-8', { fatal: false }).decode(data);
  
  const wTextMatches = textContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const extractedText = wTextMatches.map(match => {
    return match.replace(/<\/?w:t[^>]*>/g, '');
  }).join(' ');
  
  if (extractedText.length > 10) {
    return extractedText;
  }
  
  const bodyMatch = textContent.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  if (bodyMatch) {
    const bodyText = bodyMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return bodyText || '[Document body extracted]';
  }
  
  return '[DOCX file content]';
}

function ChatSidebarComponent() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('google');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.0-flash');
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>(() => loadAgentsFromStorage());
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPrompt, setNewAgentPrompt] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const apiKeys = useSettingsStore((state) => state.apiKeys);

  useEffect(() => {
    saveAgentsToStorage(agents);
  }, [agents]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentProvider = DEFAULT_PROVIDERS.find((p) => p.id === selectedProvider);

  const handleMouseEnter = useCallback(() => {
    setIsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const fileList: File[] = [];
    for (let i = 0; i < files.length; i++) {
      fileList.push(files[i]);
    }

    processFiles(fileList);
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    const newFiles: UploadedFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                     file.name.endsWith('.docx');
      
      if (isDocx) {
        try {
          const textContent = await parseDocxAsText(file);
          const reader = new FileReader();
          
          const fileData = await new Promise<string>((resolve) => {
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(file);
          });

          newFiles.push({
            id: Date.now().toString() + i,
            name: file.name,
            type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            data: fileData,
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            textContent: textContent,
          });
        } catch (err) {
          console.error('Failed to parse docx:', err);
        }
      } else {
        const reader = new FileReader();
        
        const fileData = await new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(file);
        });

        newFiles.push({
          id: Date.now().toString() + i,
          name: file.name,
          type: file.type,
          data: fileData,
          mimeType: file.type,
        });
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    const userContent = input.trim();
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent || `[上传了${uploadedFiles.length}个文件]`,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = apiKeys[selectedProvider];
      if (!apiKey) {
        setError(t('chat.apiKeyNotConfigured'));
        return;
      }

      const parts: Record<string, unknown>[] = [];
      
      if (userContent) {
        parts.push({ text: userContent });
      }
      
      for (const file of uploadedFiles) {
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
          parts.push({
            inlineData: {
              mimeType: file.mimeType,
              data: file.data,
            },
          });
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.textContent) {
          const docxText = file.textContent || '';
          const truncatedText = docxText.length > 10000 ? docxText.substring(0, 10000) + '...[内容已截断]' : docxText;
          parts.push({ text: `[文档内容 - ${file.name}]:\n${truncatedText}` });
        }
      }

      const requestBody: Record<string, unknown> = {
        contents: [
          {
            parts,
          },
        ],
      };

      if (selectedAgent?.prompt) {
        requestBody.systemInstruction = {
          parts: [{ text: selectedAgent.prompt }],
        };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API错误: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '没有收到回复';

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setUploadedFiles([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('chat.generationFailed');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, selectedProvider, selectedModel, apiKeys, t, selectedAgent, uploadedFiles]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList: File[] = [];
    for (let i = 0; i < files.length; i++) {
      fileList.push(files[i]);
    }

    await processFiles(fileList);
    e.target.value = '';
  }, [processFiles]);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const createAgent = useCallback(() => {
    if (!newAgentName.trim()) {
      alert(t('chat.enterAgentName'));
      return;
    }
    
    const newAgent: Agent = {
      id: Date.now().toString(),
      name: newAgentName.trim(),
      prompt: newAgentPrompt.trim(),
      createdAt: Date.now(),
    };
    
    setAgents((prev) => [...prev, newAgent]);
    setNewAgentName('');
    setNewAgentPrompt('');
  }, [newAgentName, newAgentPrompt, t]);

  const updateAgent = useCallback((updatedAgent: Agent) => {
    setAgents((prev) => prev.map((a) => (a.id === updatedAgent.id ? updatedAgent : a)));
    setEditingAgent(null);
  }, []);

  const deleteAgent = useCallback((agentId: string) => {
    if (!confirm(t('chat.confirmDeleteAgent'))) return;
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(null);
    }
  }, [t, selectedAgent]);

  const selectAgent = useCallback((agent: Agent | null) => {
    setSelectedAgent(agent);
    setShowAgentSettings(false);
  }, []);

  if (!isVisible) {
    return (
      <div
        className="fixed left-0 top-0 h-full w-12 hover:w-14 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transition-all duration-200 flex flex-col items-center py-4 cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onClick={handleMouseEnter}
      >
        <div className="flex flex-col items-center gap-4">
          <MessageCircle className="w-6 h-6 text-blue-600" />
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className={`fixed left-0 top-0 h-full w-[420px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 flex flex-col shadow-xl transition-all duration-200 ${isDragOver ? 'ring-4 ring-blue-400 ring-inset bg-blue-50 dark:bg-blue-900/20' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 dark:bg-blue-500/10 z-50 pointer-events-none">
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
            <Upload className="w-12 h-12 text-blue-600" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">{t('chat.dropFilesHere')}</span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-gray-900 dark:text-white">{t('chat.title')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAgentSettings(!showAgentSettings)}
            className={`p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors ${showAgentSettings ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
            title={t('chat.agentSettings')}
          >
            <Bot className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={clearMessages}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title={t('chat.clearChat')}
          >
            <Trash2 className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={handleMouseLeave}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title={t('chat.closeChat')}
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Agent Settings Panel */}
      {showAgentSettings && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 max-h-[60%] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('chat.agentManagement')}</h3>
            </div>
            
            {/* Create New Agent Form */}
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder={t('chat.agentNamePlaceholder')}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={newAgentPrompt}
                onChange={(e) => setNewAgentPrompt(e.target.value)}
                placeholder={t('chat.agentPromptPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
              />
              <button
                onClick={createAgent}
                className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('chat.createAgent')}
              </button>
            </div>
          </div>
          
          {/* Agent List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`p-3 rounded-lg border ${
                    selectedAgent?.id === agent.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {editingAgent?.id === agent.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingAgent.name}
                        onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        autoFocus
                      />
                      <textarea
                        value={editingAgent.prompt}
                        onChange={(e) => setEditingAgent({ ...editingAgent, prompt: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateAgent(editingAgent)}
                          className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          {t('chat.save')}
                        </button>
                        <button
                          onClick={() => setEditingAgent(null)}
                          className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 rounded"
                        >
                          {t('chat.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div 
                          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                          onClick={() => selectAgent(agent)}
                        >
                          <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {agent.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingAgent(agent)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title={t('chat.edit')}
                          >
                            <Edit2 className="w-3 h-3 text-gray-500" />
                          </button>
                          <button
                            onClick={() => deleteAgent(agent.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            title={t('chat.delete')}
                          >
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      </div>
                      {agent.prompt && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {agent.prompt}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
              {agents.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">{t('chat.noAgents')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Provider & Model Selection */}
      <div className="flex gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <select
          value={selectedProvider}
          onChange={(e) => {
            setSelectedProvider(e.target.value);
            const provider = DEFAULT_PROVIDERS.find((p) => p.id === e.target.value);
            setSelectedModel(provider?.defaultModel || '');
          }}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DEFAULT_PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {currentProvider?.models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {/* Active Agent Indicator */}
      {selectedAgent && !showAgentSettings && (
        <div 
          className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30"
          onClick={() => setShowAgentSettings(true)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {t('chat.activeAgent')}: {selectedAgent.name}
              </span>
            </div>
            <Edit2 className="w-3 h-3 text-blue-500" />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">{t('chat.placeholder')}</p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">{t('chat.generating')}</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"
              >
                <FileText className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
                  {file.name}
                </span>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <label className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
            <Upload className="w-5 h-5 text-gray-500" />
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept={currentProvider?.supportedFileTypes.join(',')}
            />
          </label>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.inputPlaceholder')}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">{t('chat.supportedFormats')}: PNG, JPG, WEBP, GIF, PDF, MP4, MP3, WAV, DOCX</p>
      </div>
    </div>
  );
}

export const ChatSidebar = memo(ChatSidebarComponent);