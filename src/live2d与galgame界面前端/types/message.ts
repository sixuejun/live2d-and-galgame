/**
 * 消息解析相关的类型定义
 */

export interface StatusBlockData {
  地点?: string;
  关系?: string;
  心情?: string;
  吐槽?: string;
  待办?: string;
  小剧场?: string;
  [key: string]: any;
}

export interface MessageBlock {
  type: 'character' | 'narration' | 'blacktext' | 'user' | 'choice';
  character?: string;
  scene?: string;
  motion?: string;
  expression?: string;
  text?: string;
  message?: string;
  isThrough?: boolean;
  isCG?: boolean;
  choices?: string[]; // 旧格式：[[choice||选项1||选项2||选项3]]
  choiceText?: string; // 新格式：选项文本 [[choice||选项1||角色名||台词]]
  choiceCharacter?: string; // 新格式：角色名
  choiceResponse?: string; // 新格式：台词
  // 从世界书中解析到的资源文件路径
  sceneImageUrl?: string; // 背景图片URL
  cgImageUrl?: string; // CG图片URL
  spriteImageUrl?: string; // 立绘图片URL
  motionFile?: string; // 动作文件
  expressionFile?: string; // 表情文件
}

