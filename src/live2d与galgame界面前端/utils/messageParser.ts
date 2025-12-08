/**
 * 消息解析器
 * 用于解析酒馆消息中的特殊格式块，如 [[character||...]]、[[narration||...]] 等
 */

import type {
  BackgroundResourceWorldbookData,
  CGResourceWorldbookData,
  ModelResourceWorldbookData,
  SpriteResourceWorldbookData,
} from '../../开场界面/utils/worldbookFormat';
import { parseWorldbookJsonData } from '../../开场界面/utils/worldbookFormat';
import type { MessageBlock, StatusBlockData } from '../types/message';

/**
 * 世界书资源缓存
 */
interface WorldbookResourceCache {
  models: Map<string, ModelResourceWorldbookData>; // 角色名 -> 模型数据
  sprites: Map<string, SpriteResourceWorldbookData>; // 角色名 -> 立绘数据
  backgrounds: BackgroundResourceWorldbookData | null;
  cgs: CGResourceWorldbookData | null;
}

let worldbookCache: WorldbookResourceCache | null = null;
let worldbookCacheTimestamp = 0;
let worldbookCacheSource = ''; // 记录缓存来源（角色卡名称）
const WORLDBOOK_NAME = '开场界面-模型数据';
const CACHE_DURATION = 5000; // 缓存5秒

/**
 * 从世界书中加载资源数据
 * 优先使用当前角色卡绑定的世界书
 *
 * @returns 世界书资源缓存
 */
export async function loadWorldbookResources(): Promise<WorldbookResourceCache> {
  const now = Date.now();

  // 获取当前角色卡名称
  let currentCharacterName = '';
  try {
    const rawChar = new RawCharacter(RawCharacter.find({ name: 'current' }));
    currentCharacterName = rawChar.getCardData().name || '';
  } catch (error) {
    console.warn('获取当前角色卡名称失败:', error);
  }

  // 如果缓存存在且未过期，且角色卡名称未变化，直接返回
  if (
    worldbookCache &&
    now - worldbookCacheTimestamp < CACHE_DURATION &&
    worldbookCacheSource === currentCharacterName
  ) {
    return worldbookCache;
  }

  const cache: WorldbookResourceCache = {
    models: new Map(),
    sprites: new Map(),
    backgrounds: null,
    cgs: null,
  };

  // 优先从角色卡绑定的世界书加载
  const worldbookNames: string[] = [];
  try {
    const charWorldbooks = getCharWorldbookNames('current');
    if (charWorldbooks.primary) {
      worldbookNames.push(charWorldbooks.primary);
    }
    worldbookNames.push(...charWorldbooks.additional);
  } catch (error) {
    console.warn('获取角色卡世界书失败:', error);
  }

  // 如果没有角色卡世界书，使用默认世界书
  if (worldbookNames.length === 0) {
    worldbookNames.push(WORLDBOOK_NAME);
  }

  // 从所有世界书中加载资源
  for (const worldbookName of worldbookNames) {
    try {
      const entries = await getWorldbook(worldbookName);
      for (const entry of entries) {
        if (!entry.enabled) continue;

        const data = parseWorldbookJsonData(entry.content);
        if (!data) continue;

        if (data.type === 'live2d_model') {
          const modelData = data as ModelResourceWorldbookData;
          // 如果已存在同名模型，保留第一个（角色卡绑定的优先）
          if (!cache.models.has(modelData.modelName)) {
            cache.models.set(modelData.modelName, modelData);
          }
        } else if (data.type === 'sprite') {
          const spriteData = data as SpriteResourceWorldbookData;
          if (spriteData.characterName) {
            // 如果已存在同名角色立绘，保留第一个（角色卡绑定的优先）
            if (!cache.sprites.has(spriteData.characterName)) {
              cache.sprites.set(spriteData.characterName, spriteData);
            }
          }
        } else if (data.type === 'background') {
          // 背景资源合并（不覆盖）
          if (!cache.backgrounds) {
            cache.backgrounds = data as BackgroundResourceWorldbookData;
          } else {
            const existing = cache.backgrounds;
            const newData = data as BackgroundResourceWorldbookData;
            existing.backgrounds.push(...newData.backgrounds);
          }
        } else if (data.type === 'cg') {
          // CG资源合并（不覆盖）
          if (!cache.cgs) {
            cache.cgs = data as CGResourceWorldbookData;
          } else {
            const existing = cache.cgs;
            const newData = data as CGResourceWorldbookData;
            existing.cgs.push(...newData.cgs);
          }
        }
      }
    } catch (error) {
      console.warn(`加载世界书 ${worldbookName} 失败:`, error);
    }
  }

  worldbookCache = cache;
  worldbookCacheTimestamp = now;
  worldbookCacheSource = currentCharacterName;
  return cache;
}

/**
 * 规范化文本，用于匹配（去除特殊符号，统一大小写等）
 */
function normalizeText(text: string): string {
  return text
    .replace(/[-/\\_.\s]/g, '') // 去除 - / \ _ . 空格
    .toLowerCase();
}

/**
 * 模糊匹配文本（考虑全角半角、特殊符号等）
 */
function fuzzyMatch(source: string, target: string): boolean {
  const normalizedSource = normalizeText(source);
  const normalizedTarget = normalizeText(target);
  return (
    normalizedSource === normalizedTarget ||
    normalizedSource.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedSource)
  );
}

/**
 * 解析键值对格式的文本（支持多种冒号格式）
 * 例如：角色名：程北极、场景：家中、动作：抱胸
 */
function parseKeyValuePairs(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  // 先按 || 分割成多个部分
  const parts = text
    .split('||')
    .map(p => p.trim())
    .filter(p => p);

  // 对每一部分进行键值对解析
  for (const part of parts) {
    // 匹配 "键：值" 或 "键:值" 格式（支持全角、半角冒号，以及冒号前后的空格）
    // 匹配模式：键名（冒号前的内容） + 冒号（全角或半角） + 值（冒号后的所有内容）
    const kvMatch = part.match(/^([^：:]+)[：:]\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      if (key && value) {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * 根据角色名和文本匹配世界书中的资源
 */
async function matchWorldbookResources(
  characterName: string | undefined,
  sceneText: string | undefined,
  motionText: string | undefined,
  expressionText: string | undefined,
  cgSceneText: string | undefined,
): Promise<{
  sceneImageUrl?: string;
  cgImageUrl?: string;
  spriteImageUrl?: string;
  motionFile?: string;
  expressionFile?: string;
}> {
  const result: {
    sceneImageUrl?: string;
    cgImageUrl?: string;
    spriteImageUrl?: string;
    motionFile?: string;
    expressionFile?: string;
  } = {};

  try {
    const resources = await loadWorldbookResources();

    // 匹配背景
    if (sceneText && resources.backgrounds) {
      for (const bg of resources.backgrounds.backgrounds) {
        // 匹配场景文本（不包括台词部分）
        const matchText = sceneText;
        if (fuzzyMatch(bg.name, matchText) || bg.textMappings?.some(mapping => fuzzyMatch(mapping, matchText))) {
          result.sceneImageUrl = bg.file;
          break;
        }
      }
    }

    // 匹配CG
    if (cgSceneText && resources.cgs) {
      for (const cg of resources.cgs.cgs) {
        const matchText = cgSceneText;
        if (fuzzyMatch(cg.name, matchText) || cg.textMappings?.some(mapping => fuzzyMatch(mapping, matchText))) {
          result.cgImageUrl = cg.file;
          break;
        }
      }
    }

    // 匹配立绘（需要角色名）
    if (characterName && resources.sprites.has(characterName)) {
      const spriteData = resources.sprites.get(characterName)!;
      // 使用动作或表情文本来匹配立绘（不包括台词部分）
      const matchTexts = [motionText, expressionText].filter(Boolean) as string[];
      for (const sprite of spriteData.sprites) {
        if (
          sprite.textMappings?.some(mapping => matchTexts.some(text => fuzzyMatch(mapping, text))) ||
          matchTexts.some(text => fuzzyMatch(sprite.name, text))
        ) {
          result.spriteImageUrl = sprite.file;
          break;
        }
      }
    }

    // 匹配动作和表情（需要角色名和模型数据）
    if (characterName && resources.models.has(characterName)) {
      const modelData = resources.models.get(characterName)!;

      // 匹配动作
      if (motionText) {
        // 先通过文本映射匹配
        if (modelData.textMappings?.motion) {
          for (const [file, mappingText] of Object.entries(modelData.textMappings.motion)) {
            if (fuzzyMatch(mappingText, motionText)) {
              // 找到匹配的映射，查找对应的动作文件
              const motion = (modelData.motions || []).find(m => m.file === file || m.name === file);
              if (motion) {
                result.motionFile = motion.file;
                break;
              }
            }
          }
        }
        // 如果没有通过映射匹配到，再通过文件名匹配
        if (!result.motionFile) {
          for (const motion of modelData.motions || []) {
            if (fuzzyMatch(motion.name, motionText) || fuzzyMatch(motion.file, motionText)) {
              result.motionFile = motion.file;
              break;
            }
          }
        }
      }

      // 匹配表情
      if (expressionText) {
        // 先通过文本映射匹配
        if (modelData.textMappings?.expression) {
          for (const [file, mappingText] of Object.entries(modelData.textMappings.expression)) {
            if (fuzzyMatch(mappingText, expressionText)) {
              // 找到匹配的映射，查找对应的表情文件
              const expression = (modelData.expressions || []).find(e => e.file === file || e.name === file);
              if (expression) {
                result.expressionFile = expression.file;
                break;
              }
            }
          }
        }
        // 如果没有通过映射匹配到，再通过文件名匹配
        if (!result.expressionFile) {
          for (const expression of modelData.expressions || []) {
            if (fuzzyMatch(expression.name, expressionText) || fuzzyMatch(expression.file, expressionText)) {
              result.expressionFile = expression.file;
              break;
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('匹配世界书资源失败:', error);
  }

  return result;
}

/**
 * 解析消息中的 StatusBlock 格式
 * 格式: <StatusBlock>...</StatusBlock>
 */
export function parseStatusBlock(message: string): StatusBlockData | null {
  const statusBlockRegex = /<StatusBlock>([\s\S]*?)<\/StatusBlock>/i;
  const match = message.match(statusBlockRegex);

  if (!match) {
    return null;
  }

  const content = match[1].trim();
  const statusData: StatusBlockData = {};

  // 解析字段：字段名: 值
  const fieldRegex = /(\S+?):\s*(.+?)(?=\n\S+?:|\n*$)/g;
  let fieldMatch;

  while ((fieldMatch = fieldRegex.exec(content)) !== null) {
    const key = fieldMatch[1].trim();
    const value = fieldMatch[2].trim();
    statusData[key] = value;
  }

  // 如果没有解析到字段，尝试按行解析
  if (Object.keys(statusData).length === 0) {
    const lines = content.split('\n').filter(line => line.trim());
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key && value) {
          statusData[key] = value;
        }
      }
    }
  }

  return Object.keys(statusData).length > 0 ? statusData : null;
}

/**
 * 解析消息中的各种格式块
 * 支持的格式（新格式，键值对）：
 * - [[character||角色名：程北极||场景：家中||动作：抱胸||表情：生气||台词：你怎么这样！]]
 * - [[character||角色名：||CG场景：||台词：]]
 * - [[narration||场景：||旁白：]]
 * - [[blacktext||黑屏文字：]]
 * - [[user||场景：||台词：]]
 * - [[choice||选项1：去食堂||角色名：程北极||台词：好的，我们一起去吧！]] - 继续剧情演出
 * - [[choice||选项1：去食堂||选项2：去图书馆||选项3：回宿舍]] - 触发AI生成
 *
 * 智能识别：支持中文英文全角半角冒号，识别关键字（角色名、场景等）
 * 只解析 <content>...</content> 标签中的内容
 */
export async function parseMessageBlocks(message: string, lastScene?: string): Promise<MessageBlock[]> {
  const blocks: MessageBlock[] = [];
  let currentScene = lastScene; // 当前场景，用于继承

  // 提取 <content>...</content> 标签中的内容
  const contentMatch = message.match(/<content>([\s\S]*?)<\/content>/i);
  const contentText = contentMatch ? contentMatch[1] : message;

  // 匹配 [[type||...]] 格式
  const blockRegex = /\[\[(\w+)\|\|([^\]]*)\]\]/g;
  let match;

  while ((match = blockRegex.exec(contentText)) !== null) {
    const type = match[1] as MessageBlock['type'];
    const content = match[2];

    if (type === 'character') {
      // 解析键值对格式
      const kvPairs = parseKeyValuePairs(content);

      const block: MessageBlock = {
        type: 'character',
      };

      // 新格式：[[character||角色名：程北极||场景：家中||动作：抱胸||表情：生气||台词：你怎么这样！]]
      block.character = kvPairs['角色名'] || kvPairs['character'] || '';

      // 检查是否有CG场景
      const cgScene = kvPairs['CG场景'] || kvPairs['cg场景'] || kvPairs['CG'] || kvPairs['cg'];
      if (cgScene) {
        block.scene = cgScene;
        block.text = kvPairs['台词'] || kvPairs['text'] || '';
        block.isCG = true;
      } else {
        // 普通格式
        block.scene = kvPairs['场景'] || kvPairs['scene'] || currentScene;
        block.motion = kvPairs['动作'] || kvPairs['motion'] || '';
        block.expression = kvPairs['表情'] || kvPairs['expression'] || '';
        block.text = kvPairs['台词'] || kvPairs['text'] || '';

        // 如果没有动作和表情，进入CG模式
        if (!block.motion && !block.expression) {
          block.isCG = true;
        }
      }

      // 如果没有解析到场景，使用继承的场景
      if (!block.scene && currentScene) {
        block.scene = currentScene;
      }

      // 更新当前场景
      if (block.scene) {
        currentScene = block.scene;
      }

      // 不再设置 isThrough，因为只有*星号包裹*的部分应该是灰色，不是整行
      // 保留 *星号包裹* 的原始格式，用于显示时格式化

      // 匹配世界书资源
      const resources = await matchWorldbookResources(
        block.character,
        block.isCG ? undefined : block.scene, // CG模式时场景文本用于匹配CG，否则用于匹配背景
        block.motion,
        block.expression,
        block.isCG ? block.scene : undefined, // CG模式时场景文本用于匹配CG
      );
      Object.assign(block, resources);

      blocks.push(block);
    } else if (type === 'narration') {
      // 新格式：[[narration||场景：||旁白：]]
      const kvPairs = parseKeyValuePairs(content);

      const scene = kvPairs['场景'] || kvPairs['scene'] || currentScene;
      const messageText = kvPairs['旁白'] || kvPairs['旁白内容'] || kvPairs['text'] || kvPairs['内容'] || content;

      // 更新当前场景
      if (scene) {
        currentScene = scene;
      }

      const block: MessageBlock = {
        type: 'narration',
        scene,
        message: messageText,
      };

      // 匹配背景资源
      if (scene) {
        const resources = await matchWorldbookResources(undefined, scene, undefined, undefined, undefined);
        if (resources.sceneImageUrl) {
          block.sceneImageUrl = resources.sceneImageUrl;
        }
      }

      blocks.push(block);
    } else if (type === 'blacktext') {
      // 新格式：[[blacktext||黑屏文字：]]
      const kvPairs = parseKeyValuePairs(content);
      const messageText = kvPairs['黑屏文字'] || kvPairs['text'] || kvPairs['文字'] || content;

      blocks.push({
        type: 'blacktext',
        message: messageText,
      });
    } else if (type === 'user') {
      // 新格式：[[user||场景：||台词：]]
      const kvPairs = parseKeyValuePairs(content);

      const scene = kvPairs['场景'] || kvPairs['scene'] || currentScene;
      let messageText = kvPairs['台词'] || kvPairs['用户消息'] || kvPairs['消息'] || kvPairs['text'] || content;

      // 处理用户输入中的特殊格式：
      // *星号包裹* 表示内心想法（保留原格式，用于显示时格式化）
      // 【】包裹 表示旁白（需要单独解析）
      const thoughtRegex = /\*([^*]+)\*/g;
      const narrationRegex = /【([^】]+)】/g;

      // 检查是否有旁白（【】包裹的内容）
      const narrationMatches: string[] = [];
      let narrationMatch;
      while ((narrationMatch = narrationRegex.exec(messageText)) !== null) {
        narrationMatches.push(narrationMatch[1]);
      }

      // 移除旁白部分，保留其他内容
      messageText = messageText.replace(narrationRegex, '').trim();

      // 保留 *星号包裹* 的原始格式，不转换为 *through*（用于显示时格式化）

      // 更新当前场景
      if (scene) {
        currentScene = scene;
      }

      // 如果有旁白，先创建旁白块
      for (const narrationText of narrationMatches) {
        const narrationBlock: MessageBlock = {
          type: 'narration',
          scene,
          message: narrationText,
        };

        // 匹配背景资源
        if (scene) {
          const resources = await matchWorldbookResources(undefined, scene, undefined, undefined, undefined);
          if (resources.sceneImageUrl) {
            narrationBlock.sceneImageUrl = resources.sceneImageUrl;
          }
        }

        blocks.push(narrationBlock);
      }

      // 创建用户消息块
      // 注意：不再设置 isThrough，因为只有*星号包裹*的部分应该是灰色，不是整行
      const block: MessageBlock = {
        type: 'user',
        scene,
        message: messageText,
      };

      // 匹配背景资源
      if (scene) {
        const resources = await matchWorldbookResources(undefined, scene, undefined, undefined, undefined);
        if (resources.sceneImageUrl) {
          block.sceneImageUrl = resources.sceneImageUrl;
        }
      }

      blocks.push(block);
    } else if (type === 'choice') {
      // 只支持两种格式：
      // 1. [[choice||选项1：去食堂||角色名：程北极||台词：好的，我们一起去吧！]] - 继续剧情演出
      // 2. [[choice||选项1：去食堂||选项2：去图书馆||选项3：回宿舍]] - 触发AI生成
      const kvPairs = parseKeyValuePairs(content);

      // 检查是否有角色名和台词（格式1：继续剧情演出）
      const choiceCharacter = kvPairs['角色名'] || kvPairs['character'];
      const choiceResponse = kvPairs['台词'] || kvPairs['response'] || kvPairs['text'];

      if (choiceCharacter && choiceResponse) {
        // 格式1：带角色回复的选项（继续剧情演出）
        const choiceText = kvPairs['选项1'] || kvPairs['选项1：'] || kvPairs['choice1'];
        if (choiceText) {
          blocks.push({
            type: 'choice',
            choiceText,
            choiceCharacter,
            choiceResponse,
          });
        }
      } else {
        // 格式2：纯选项列表（触发AI生成）
        const choices: string[] = [];
        let i = 1;
        while (kvPairs[`选项${i}`] || kvPairs[`选项${i}：`] || kvPairs[`choice${i}`]) {
          const choice = kvPairs[`选项${i}`] || kvPairs[`选项${i}：`] || kvPairs[`choice${i}`];
          if (choice) {
            choices.push(choice);
          }
          i++;
        }

        if (choices.length > 0) {
          blocks.push({
            type: 'choice',
            choices,
          });
        }
      }
    }
  }

  return blocks;
}

/**
 * 检查角色是否有对应的动作和表情文件
 */
export function hasMotionAndExpression(
  characterName: string,
  motion?: string,
  expression?: string,
  live2dModels?: any[],
): boolean {
  if (!characterName || !live2dModels || live2dModels.length === 0) {
    return false;
  }

  const model = live2dModels.find(m => m.name === characterName);
  if (!model) {
    return false;
  }

  // 检查是否有动作
  if (motion) {
    const hasMotion = model.motions?.some((m: any) => {
      const motionName = typeof m === 'string' ? m : m.name || m.file;
      return motionName === motion || motionName === `${motion}.motion3.json`;
    });
    if (!hasMotion) {
      return false;
    }
  }

  // 检查是否有表情
  if (expression) {
    const hasExpression = model.expressions?.some((e: any) => {
      const exprName = typeof e === 'string' ? e : e.name || e.file;
      return exprName === expression || exprName === `${expression}.exp3.json`;
    });
    if (!hasExpression) {
      return false;
    }
  }

  return true;
}
