export interface StyleOption {
  value: string;
  label: string;
  labelKey: string;
  description: string;
  descriptionKey: string;
}

export const IMAGE_STYLE_OPTIONS: StyleOption[] = [
  {
    value: 'default',
    label: '默认风格',
    labelKey: 'styles.default',
    description: '使用模型默认风格',
    descriptionKey: 'styles.defaultDesc',
  },
  {
    value: 'realistic',
    label: '写实风格',
    labelKey: 'styles.realistic',
    description: '高度逼真的照片级图像',
    descriptionKey: 'styles.realisticDesc',
  },
  {
    value: 'anime',
    label: '动漫风格',
    labelKey: 'styles.anime',
    description: '日式动漫或漫画风格',
    descriptionKey: 'styles.animeDesc',
  },
  {
    value: 'watercolor',
    label: '水彩风格',
    labelKey: 'styles.watercolor',
    description: '柔和透明的水彩画效果',
    descriptionKey: 'styles.watercolorDesc',
  },
  {
    value: 'oil_painting',
    label: '油画风格',
    labelKey: 'styles.oilPainting',
    description: '厚重质感的古典油画风格',
    descriptionKey: 'styles.oilPaintingDesc',
  },
  {
    value: 'cyberpunk',
    label: '赛博朋克风格',
    labelKey: 'styles.cyberpunk',
    description: '霓虹灯光、未来科技感',
    descriptionKey: 'styles.cyberpunkDesc',
  },
  {
    value: 'pixel_art',
    label: '像素风格',
    labelKey: 'styles.pixelArt',
    description: '复古像素艺术风格',
    descriptionKey: 'styles.pixelArtDesc',
  },
  {
    value: 'sketch',
    label: '素描风格',
    labelKey: 'styles.sketch',
    description: '黑白铅笔素描效果',
    descriptionKey: 'styles.sketchDesc',
  },
  {
    value: 'chinese_painting',
    label: '中国画风格',
    labelKey: 'styles.chinesePainting',
    description: '传统中国水墨画风格',
    descriptionKey: 'styles.chinesePaintingDesc',
  },
  {
    value: 'minimalist',
    label: '极简风格',
    labelKey: 'styles.minimalist',
    description: '简洁、留白、几何构图',
    descriptionKey: 'styles.minimalistDesc',
  },
];

export const DEFAULT_STYLE_VALUE = 'default';

export function getStyleOption(value: string): StyleOption | undefined {
  return IMAGE_STYLE_OPTIONS.find((option) => option.value === value);
}

export function getStylePrompt(styleValue: string): string {
  if (styleValue === DEFAULT_STYLE_VALUE) {
    return '';
  }

  const styleOption = getStyleOption(styleValue);
  if (!styleOption) {
    return '';
  }

  // 返回用于提示词的风格描述
  const stylePrompts: Record<string, string> = {
    realistic: '写实风格，照片级真实感',
    anime: '动漫风格，日式漫画风格',
    watercolor: '水彩风格，柔和透明的水彩画效果',
    oil_painting: '油画风格，厚重质感的古典油画',
    cyberpunk: '赛博朋克风格，霓虹灯光，未来科技感',
    pixel_art: '像素风格，复古像素艺术',
    sketch: '素描风格，黑白铅笔素描',
    chinese_painting: '中国画风格，传统中国水墨画',
    minimalist: '极简风格，简洁留白，几何构图',
  };

  return stylePrompts[styleValue] || '';
}