import { generateText, setTextApiKey } from '@/commands/text';
import { getTextModel } from '@/features/canvas/models';

const TEXT_ANALYSIS_SYSTEM_PROMPT = `你是一个专业的剧本分析助手。你的任务是将用户提供的文本内容分析整理为分镜描述。

请按照以下要求分析文本：
1. 将文本分解为多个分镜场景
2. 每个分镜应该是一个完整的视觉场景
3. 描述应该详细、具体，适合AI图像生成
4. 包括场景、角色、动作、表情、环境等视觉元素
5. 每个分镜描述控制在100-200字左右

请严格按照以下JSON格式返回分析结果：
{
  "frames": [
    {
      "description": "分镜描述内容",
      "note": "可选的备注信息"
    }
  ]
}

只返回JSON，不要包含其他内容。`;

export async function parseTextWithAI(
  textContent: string,
  modelId: string,
  apiKey?: string
): Promise<Array<{ description: string; note: string }>> {
  if (!textContent.trim()) {
    throw new Error('文本内容不能为空');
  }

  try {
    // 设置API密钥（如果提供）
    if (apiKey) {
      const model = getTextModel(modelId);
      await setTextApiKey(model.providerId, apiKey);
    }
    
    const response = await generateText({
      prompt: `请分析以下文本内容，并生成分镜描述：\n\n${textContent}`,
      model: modelId,
      system_prompt: TEXT_ANALYSIS_SYSTEM_PROMPT,
      max_tokens: 4000,
      temperature: 0.7,
    });

    const text = response.text.trim();
    
    // 尝试解析JSON响应
    let parsedData: { frames: Array<{ description: string; note?: string }> };
    
    try {
      // 尝试直接解析JSON
      parsedData = JSON.parse(text);
    } catch {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法从AI响应中提取JSON数据');
      }
      
      try {
        parsedData = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error('AI返回的JSON格式无效');
      }
    }

    if (!parsedData.frames || !Array.isArray(parsedData.frames)) {
      throw new Error('AI返回的数据格式不正确');
    }

    // 转换为分镜帧格式
    const frames = parsedData.frames.map((frame, index) => ({
      description: frame.description || `分镜${index + 1}`,
      note: frame.note || '',
    }));

    return frames;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('文本分析失败');
  }
}