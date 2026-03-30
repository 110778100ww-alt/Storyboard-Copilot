import { memo, useCallback, useEffect } from 'react';
import { type NodeProps, Handle, Position } from '@xyflow/react';
import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';

import { CANVAS_NODE_TYPES, type TextAnnotationNodeData } from '@/features/canvas/domain/canvasNodes';
import { resolveNodeDisplayName } from '@/features/canvas/domain/nodeDisplay';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { NodeResizeHandle } from '@/features/canvas/ui/NodeResizeHandle';
import { useCanvasStore } from '@/stores/canvasStore';
import { canvasEventBus } from '@/features/canvas/application/canvasServices';
import { parseTextWithAI } from '@/features/canvas/application/textParser';
import { DEFAULT_TEXT_MODEL_ID } from '@/features/canvas/models';
import { useSettingsStore } from '@/stores/settingsStore';
import { getTextModel } from '@/features/canvas/models';

type TextAnnotationNodeProps = NodeProps & {
  id: string;
  data: TextAnnotationNodeData;
  selected?: boolean;
};

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 180;
const MIN_WIDTH = 180;
const MIN_HEIGHT = 100;
const MAX_WIDTH = 900;
const MAX_HEIGHT = 900;

export const TextAnnotationNode = memo(({
  id,
  data,
  selected,
  width,
  height,
}: TextAnnotationNodeProps) => {
  const { t } = useTranslation();
  const setSelectedNode = useCanvasStore((state) => state.setSelectedNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const apiKeys = useSettingsStore((state) => state.apiKeys);
  const content = typeof data.content === 'string' ? data.content : '';
  const resolvedTitle = resolveNodeDisplayName(CANVAS_NODE_TYPES.textAnnotation, data);
  const resolvedWidth = Math.max(MIN_WIDTH, Math.round(width ?? DEFAULT_WIDTH));
  const resolvedHeight = Math.max(MIN_HEIGHT, Math.round(height ?? DEFAULT_HEIGHT));
  const handleMarkdownLinkClick = useCallback((href?: string) => {
    if (!href) {
      return;
    }
    void openUrl(href);
  }, []);

  // 解析文本中的分镜序号内容
  const parseStoryboardNumbering = useCallback((text: string): Array<{ description: string; note: string }> | null => {
    if (!text.trim()) return null;
    
    const lines = text.split('\n');
    const frames: Array<{ description: string; note: string }> = [];
    let currentFrame: { description: string; note: string } | null = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 匹配分镜序号模式：分镜1、分镜2、分镜1：、分镜1：内容等
      const match = trimmedLine.match(/^分镜\s*(\d+)\s*[：:]\s*(.*)$/);
      if (match) {
        // 保存前一个分镜（如果有）
        if (currentFrame) {
          frames.push(currentFrame);
        }
        
        // 开始新的分镜
        const frameNumber = parseInt(match[1]);
        const content = match[2].trim();
        
        // 确保分镜序号是连续的
        if (frameNumber === frames.length + 1) {
          currentFrame = {
            description: content,
            note: '',
          };
        } else {
          // 序号不连续，跳过
          currentFrame = null;
        }
      } else if (currentFrame && trimmedLine) {
        // 如果是当前分镜的后续内容，添加到描述中
        currentFrame.description += (currentFrame.description ? '\n' : '') + trimmedLine;
      }
    }
    
    // 添加最后一个分镜
    if (currentFrame) {
      frames.push(currentFrame);
    }
    
    // 只有当至少有两个分镜时才返回结果
    return frames.length >= 2 ? frames : null;
  }, []);

  // 监听连接变化，当连接到分镜生成节点时自动分析文本
  useEffect(() => {
    // 查找连接到的分镜生成节点
    const storyboardGenNodeIds = edges
      .filter((edge) => edge.source === id)
      .map((edge) => edge.target)
      .filter((targetId) => {
        const targetNode = nodes.find((node) => node.id === targetId);
        return targetNode?.type === 'storyboardGenNode';
      });
    
    // 如果有分镜生成节点连接且有内容，自动分析
    if (storyboardGenNodeIds.length > 0 && content.trim()) {
      const analyzeText = async () => {
        try {
          // 首先尝试解析序号内容
          const numberedFrames = parseStoryboardNumbering(content);
          
          if (numberedFrames) {
            // 如果有序号内容，直接使用
            storyboardGenNodeIds.forEach((nodeId) => {
              canvasEventBus.publish('text-annotation/fill-storyboard', {
                nodeId,
                frames: numberedFrames,
              });
            });
          } else {
            // 如果没有序号内容，使用AI分析
            const modelId = DEFAULT_TEXT_MODEL_ID;
            const model = getTextModel(modelId);
            const providerApiKey = apiKeys[model.providerId] ?? '';
            
            const frames = await parseTextWithAI(content, modelId, providerApiKey);
            
            // 发送事件给所有连接的分镜生成节点
            storyboardGenNodeIds.forEach((nodeId) => {
              canvasEventBus.publish('text-annotation/fill-storyboard', {
                nodeId,
                frames,
              });
            });
          }
        } catch (error) {
          console.error('文本分析失败:', error);
        }
      };
      
      // 延迟执行，避免频繁调用
      const timer = setTimeout(analyzeText, 1000);
      return () => clearTimeout(timer);
    }
  }, [id, edges, nodes, content, apiKeys, parseStoryboardNumbering]);

  return (
    <div
      className={`
        group relative h-full w-full overflow-visible rounded-[var(--node-radius)] border bg-surface-dark/85 p-1.5 transition-colors duration-150
        ${selected
          ? 'border-accent shadow-[0_0_0_1px_rgba(59,130,246,0.32)]'
          : 'border-[rgba(15,23,42,0.22)] hover:border-[rgba(15,23,42,0.34)] dark:border-[rgba(255,255,255,0.22)] dark:hover:border-[rgba(255,255,255,0.34)]'}
      `}
      style={{ width: resolvedWidth, height: resolvedHeight }}
      onClick={() => setSelectedNode(id)}
    >
      <NodeHeader
        className={NODE_HEADER_FLOATING_POSITION_CLASS}
        icon={<FileText className="h-4 w-4" />}
        titleText={resolvedTitle}
        editable
        onTitleChange={(nextTitle) => updateNodeData(id, { displayName: nextTitle })}
      />

      <NodeResizeHandle
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        maxWidth={MAX_WIDTH}
        maxHeight={MAX_HEIGHT}
      />

      {selected ? (
        <textarea
          autoFocus
          value={content}
          onChange={(event) => {
            const nextValue = event.target.value;
            updateNodeData(id, { content: nextValue });
          }}
          placeholder={t('node.textAnnotation.placeholder')}
          className="nodrag nowheel h-full w-full resize-none border-none bg-transparent px-1 py-0.5 text-sm leading-6 text-text-dark outline-none placeholder:text-text-muted/70"
        />
      ) : (
        <div className="nodrag nowheel h-full w-full overflow-auto px-1 py-0.5 text-sm leading-6 text-text-dark">
          {content.trim().length > 0 ? (
            <div className="markdown-body break-words [&_a]:text-accent [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-[15px] [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_hr]:border-white/10 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+_p]:mt-4 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-black/30 [&_pre]:p-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  a: ({ href, children, ...props }) => (
                    <a
                      {...props}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => {
                        event.preventDefault();
                        handleMarkdownLinkClick(href);
                      }}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="pt-1 text-text-muted">{t('node.textAnnotation.empty')}</div>
          )}
        </div>
      )}
      
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-blue-400/50 border-2 border-blue-500 pointer-events-none z-10" />
      <Handle
        type="source"
        id="source"
        position={Position.Right}
        className="!h-6 !w-6 !-mr-3 !bg-transparent !border-0"
      />
    </div>
  );
});

TextAnnotationNode.displayName = 'TextAnnotationNode';
