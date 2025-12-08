/**
 * 开场界面类型定义
 */

/** 页面类型 */
export type PageType = 'main-menu' | 'start-game' | 'settings' | 'character-intro' | 'model-upload';

/** 开场数据 */
export interface Opening {
  id: string;
  title: string;
  description: string;
  image?: string;
  message: string;
}

/** 角色数据 */
export interface Character {
  name: string;
  role: string;
  desc: string;
  image?: string;
  colorClass: string;
}

/** 文本到动作/表情的映射 */
export interface TextToAnimationMapping {
  text: string;
  expression: string;
  motion: string;
}

/** 默认动画设置 */
export interface DefaultAnimationSettings {
  expression: string;
  motion: string;
  autoLoop: boolean;
}

/** 已导入的模型 */
export interface ImportedModel {
  name: string;
  files: ModelFile[];
  motions: MotionFile[];
  /** 默认动画设置 */
  defaultAnimation?: DefaultAnimationSettings;
  /** 文本到动作/表情的映射 */
  textMappings?: TextToAnimationMapping[];
}

/** 模型文件 */
export interface ModelFile {
  type: 'texture' | 'moc3' | 'model3' | 'cdi3';
  url: string;
  filename: string;
  /** 如果是本地文件，存储 IndexedDB 文件 ID */
  fileId?: string;
  /** 是否为本地文件（存储在 IndexedDB 中） */
  isLocal?: boolean;
}

/** 动作/表情文件 */
export interface MotionFile {
  name: string;
  url: string;
  type: 'motion' | 'expression';
  /** 如果是本地文件，存储 IndexedDB 文件 ID */
  fileId?: string;
  /** 是否为本地文件（存储在 IndexedDB 中） */
  isLocal?: boolean;
}

/** 解析到的文件URL信息 */
export interface ParsedFileUrl {
  type: 'texture' | 'moc3' | 'model3' | 'cdi3' | 'physics3' | 'motion' | 'expression';
  url: string;
  filename: string;
  name?: string;
}

/** 虚拟文件（用于内部处理） */
export interface VirtualModelFiles {
  textures: { file: File; url: string }[];
  moc3: { file: File; url: string } | null;
  model3: { file: File; url: string } | null;
  cdi3: { file: File; url: string } | null;
  motions: { file: File; url: string; name: string; type: 'motion' | 'expression' }[];
}

/** 资源文件类型 */
export type ResourceFileType = 'sprite' | 'background' | 'cg';

/** 资源文件 */
export interface ResourceFile {
  name: string;
  file: File;
  type: ResourceFileType;
  /** 如果是本地文件，存储 IndexedDB 文件 ID */
  fileId?: string;
  /** 是否为本地文件（存储在 IndexedDB 中） */
  isLocal?: boolean;
  /** 文本绑定映射 */
  textMappings?: TextMapping[];
}

/** 文本映射（用于资源绑定） */
export interface TextMapping {
  text: string;
  /** 资源文件名或标识 */
  resource: string;
}

/** 角色立绘资源 */
export interface SpriteResource {
  name: string;
  file: File;
  fileId?: string;
  isLocal?: boolean;
  /** 文本绑定：触发文本 -> 资源标识 */
  textMappings?: Array<{ text: string; resource: string }>;
}

/** 背景资源 */
export interface BackgroundResource {
  name: string;
  file: File;
  fileId?: string;
  isLocal?: boolean;
  /** 文本绑定 */
  textMappings?: Array<{ text: string; resource: string }>;
}

/** CG资源 */
export interface CGResource {
  name: string;
  file: File;
  fileId?: string;
  isLocal?: boolean;
  /** 文本绑定 */
  textMappings?: Array<{ text: string; resource: string }>;
}

/** 已上传的资源集合 */
export interface UploadedResources {
  /** 模型相关文件 */
  model?: {
    name: string;
    files: VirtualModelFiles;
  };
  /** 角色立绘 */
  sprites: SpriteResource[];
  /** 背景 */
  backgrounds: BackgroundResource[];
  /** CG */
  cgs: CGResource[];
}
