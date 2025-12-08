/**
 * Live2D模型渲染器
 * 使用动态加载方式加载 pixi-live2d-display
 *
 * 优势：
 * - 避免编译时依赖冲突
 * - Live2D Cubism Core 会自动从 CDN 加载
 * - 运行时按需加载，减少初始包体积
 * - 支持从 IndexedDB 加载本地文件
 */

import { getIndexedDbFileUrl } from '../../utils/indexedDB';

// Live2D 模型配置接口
export interface Live2DModelConfig {
  id: string;
  name: string;
  modelPath: string;
  basePath: string;
  version: number;
  motions: Array<{ group: string; name: string; file: string }>;
  expressions: string[];
  textures: string[];
  physics?: string;
  pose?: string;
  /** 本地文件的 fileId 映射（仅用于 IndexedDB 存储的文件） */
  _fileIds?: Record<string, string>;
  /** 默认动画配置（从世界书读取） */
  defaultAnimation?: {
    motion?: string;
    expression?: string;
    autoLoop?: boolean;
  };
}

// 声明全局类型
declare global {
  interface Window {
    PIXI: typeof import('pixi.js');
    Live2DModel: any;
  }
}

// 动态加载脚本
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已加载
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
    document.head.appendChild(script);
  });
}

// 初始化 Live2D 依赖
let live2dInitPromise: Promise<void> | null = null;

async function initLive2DDependencies(): Promise<void> {
  if (live2dInitPromise) return live2dInitPromise;

  live2dInitPromise = (async () => {
    try {
      // 加载 pixi.js v6（兼容 pixi-live2d-display）
      await loadScript('https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js');

      // 加载 pixi-live2d-display
      await loadScript('https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js');

      // 注册 Live2D ticker
      if (window.PIXI && window.Live2DModel) {
        window.Live2DModel.registerTicker(window.PIXI.Ticker.shared);
        console.info('Live2D 依赖加载成功');
      } else {
        throw new Error('Live2D 依赖加载失败');
      }
    } catch (error) {
      live2dInitPromise = null;
      throw error;
    }
  })();

  return live2dInitPromise;
}

export class Live2DRenderer {
  private app: any = null;
  private currentModel: any = null;
  private modelConfig: Live2DModelConfig | null = null;
  private isInitialized = false;
  private currentMotionGroup: string | null = null;
  private currentMotionIndex: number = 0;
  private isLoopingDefaultMotion = false; // 标记是否正在循环播放默认动作
  private defaultMotionLoopTimer: ReturnType<typeof setInterval> | null = null; // 默认动作循环定时器

  /**
   * 初始化渲染器
   */
  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 加载 Live2D 依赖
      await initLive2DDependencies();

      // 创建 PixiJS 应用
      const canvasElement = canvas;
      this.app = new window.PIXI.Application({
        view: canvasElement,
        autoStart: true,
        backgroundAlpha: 0, // 透明背景
        resizeTo: canvasElement.parentElement || canvasElement,
        antialias: true,
      });

      this.isInitialized = true;
      console.info('Live2D渲染器初始化成功');
    } catch (error) {
      console.error('Live2D渲染器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载模型
   */
  async loadModel(config: Live2DModelConfig): Promise<void> {
    if (!this.isInitialized || !this.app) {
      throw new Error('渲染器未初始化');
    }

    try {
      // 卸载当前模型
      if (this.currentModel) {
        this.unloadModel();
      }

      this.modelConfig = config;

      // 构建完整的模型路径
      let modelUrl = config.modelPath;
      if (!modelUrl.startsWith('http://') && !modelUrl.startsWith('https://')) {
        modelUrl = config.basePath ? `${config.basePath}${modelUrl}` : modelUrl;
      }

      // 检查是否是 IndexedDB 存储的本地文件
      if (modelUrl.startsWith('indexeddb://')) {
        console.info(`[Live2DRenderer] 检测到 IndexedDB 协议，从本地存储加载: ${modelUrl}`);

        // 从 IndexedDB 读取 model3.json 文件
        const blobUrl = await getIndexedDbFileUrl(modelUrl, config._fileIds);
        if (!blobUrl) {
          throw new Error(`无法从 IndexedDB 读取文件: ${modelUrl}`);
        }

        // 读取并修改 model3.json，将相对路径替换为 IndexedDB Blob URL
        try {
          const response = await fetch(blobUrl);
          const modelJson = await response.json();

          // 修改 FileReferences 中的相对路径为 IndexedDB Blob URL
          if (modelJson.FileReferences && config.basePath?.startsWith('indexeddb://') && config._fileIds) {
            const basePath = config.basePath;

            // 处理 MOC 文件路径
            if (modelJson.FileReferences.Moc && typeof modelJson.FileReferences.Moc === 'string') {
              const mocPath = modelJson.FileReferences.Moc;
              if (!mocPath.startsWith('http') && !mocPath.startsWith('blob:')) {
                const indexedDbUrl = `${basePath}${mocPath}`;
                const mocBlobUrl = await getIndexedDbFileUrl(indexedDbUrl, config._fileIds);
                if (mocBlobUrl) {
                  modelJson.FileReferences.Moc = mocBlobUrl;
                  console.info(`[Live2DRenderer] 替换 MOC 路径: ${mocPath} -> IndexedDB Blob URL`);
                }
              }
            }

            // 处理纹理文件路径
            if (Array.isArray(modelJson.FileReferences.Textures)) {
              for (let i = 0; i < modelJson.FileReferences.Textures.length; i++) {
                const texturePath = modelJson.FileReferences.Textures[i];
                if (
                  typeof texturePath === 'string' &&
                  !texturePath.startsWith('http') &&
                  !texturePath.startsWith('blob:')
                ) {
                  const indexedDbUrl = `${basePath}${texturePath}`;
                  const textureBlobUrl = await getIndexedDbFileUrl(indexedDbUrl, config._fileIds);
                  if (textureBlobUrl) {
                    modelJson.FileReferences.Textures[i] = textureBlobUrl;
                    console.info(`[Live2DRenderer] 替换纹理路径: ${texturePath} -> IndexedDB Blob URL`);
                  }
                }
              }
            }

            // 处理物理文件路径
            if (modelJson.FileReferences.Physics && typeof modelJson.FileReferences.Physics === 'string') {
              const physicsPath = modelJson.FileReferences.Physics;
              if (!physicsPath.startsWith('http') && !physicsPath.startsWith('blob:')) {
                const indexedDbUrl = `${basePath}${physicsPath}`;
                const physicsBlobUrl = await getIndexedDbFileUrl(indexedDbUrl, config._fileIds);
                if (physicsBlobUrl) {
                  modelJson.FileReferences.Physics = physicsBlobUrl;
                  console.info(`[Live2DRenderer] 替换物理文件路径: ${physicsPath} -> IndexedDB Blob URL`);
                }
              }
            }

            // 处理显示信息文件路径
            if (modelJson.FileReferences.DisplayInfo && typeof modelJson.FileReferences.DisplayInfo === 'string') {
              const displayPath = modelJson.FileReferences.DisplayInfo;
              if (!displayPath.startsWith('http') && !displayPath.startsWith('blob:')) {
                const indexedDbUrl = `${basePath}${displayPath}`;
                const displayBlobUrl = await getIndexedDbFileUrl(indexedDbUrl, config._fileIds);
                if (displayBlobUrl) {
                  modelJson.FileReferences.DisplayInfo = displayBlobUrl;
                  console.info(`[Live2DRenderer] 替换显示信息文件路径: ${displayPath} -> IndexedDB Blob URL`);
                }
              }
            }

            // 处理 Groups 中的动作文件路径（如果存在）
            if (Array.isArray(modelJson.FileReferences.Groups)) {
              for (const group of modelJson.FileReferences.Groups) {
                if (
                  group.File &&
                  typeof group.File === 'string' &&
                  !group.File.startsWith('http') &&
                  !group.File.startsWith('blob:')
                ) {
                  const indexedDbUrl = `${basePath}${group.File}`;
                  const groupBlobUrl = await getIndexedDbFileUrl(indexedDbUrl, config._fileIds);
                  if (groupBlobUrl) {
                    group.File = groupBlobUrl;
                    console.info(`[Live2DRenderer] 替换动作文件路径: ${group.File} -> IndexedDB Blob URL`);
                  }
                }
                if (Array.isArray(group.Files)) {
                  for (let i = 0; i < group.Files.length; i++) {
                    const filePath = group.Files[i];
                    if (typeof filePath === 'string' && !filePath.startsWith('http') && !filePath.startsWith('blob:')) {
                      const indexedDbUrl = `${basePath}${filePath}`;
                      const fileBlobUrl = await getIndexedDbFileUrl(indexedDbUrl, config._fileIds);
                      if (fileBlobUrl) {
                        group.Files[i] = fileBlobUrl;
                        console.info(`[Live2DRenderer] 替换动作文件路径: ${filePath} -> IndexedDB Blob URL`);
                      }
                    }
                  }
                }
              }
            }

            // 创建修改后的 model3.json 的 Blob URL
            const modifiedJsonBlob = new Blob([JSON.stringify(modelJson)], { type: 'application/json' });
            const modifiedJsonUrl = URL.createObjectURL(modifiedJsonBlob);
            modelUrl = modifiedJsonUrl;
            console.info(`[Live2DRenderer] 已修改 model3.json，使用临时 Blob URL`);
          } else {
            // 如果不需要修改，直接使用原始 Blob URL
            modelUrl = blobUrl;
          }
        } catch (error) {
          console.warn(`[Live2DRenderer] 修改 model3.json 失败，使用原始文件:`, error);
          modelUrl = blobUrl;
        }

        console.info(`[Live2DRenderer] 已从 IndexedDB 加载文件，Blob URL: ${modelUrl.substring(0, 50)}...`);
      }

      console.info(`正在加载模型: ${modelUrl}`);

      // 使用 pixi-live2d-display 加载模型
      const model = await window.Live2DModel.from(modelUrl, {
        requestIdle: false,
      });

      // 设置模型位置和大小
      model.anchor.set(0.5, 0.5);
      model.x = this.app.screen.width / 2;
      model.y = this.app.screen.height / 2;

      // 根据画布大小自动缩放
      const scale = Math.min(
        (this.app.screen.width * 0.8) / model.width,
        (this.app.screen.height * 0.8) / model.height,
        1,
      );
      model.scale.set(scale);

      // 添加到舞台
      this.app.stage.addChild(model);
      this.currentModel = model;
      this.modelConfig = config;

      // 应用默认表情（如果设置了）
      if (config.defaultAnimation?.expression && config.expressions) {
        const expressionIndex = config.expressions.findIndex((e: string) => {
          // expressions 是 string[]
          return e === config.defaultAnimation?.expression || e === `${config.defaultAnimation?.expression}.exp3.json`;
        });
        if (expressionIndex !== undefined && expressionIndex >= 0) {
          model.expression(expressionIndex);
          console.info(`应用默认表情: ${config.defaultAnimation.expression}`);
        }
      }

      // 如果设置了默认动作且需要自动循环，启动循环播放（使用IDLE优先级）
      if (config.defaultAnimation?.motion && config.defaultAnimation?.autoLoop) {
        this.startDefaultMotionLoop(config.defaultAnimation.motion);
      } else if (config.defaultAnimation?.motion && !config.defaultAnimation?.autoLoop) {
        // 如果设置了默认动作但不需要循环，只播放一次（使用NORMAL优先级）
        const motionConfig = config.motions?.find((m: any) => {
          const name = typeof m === 'string' ? m : m.name || m.file;
          return name === config.defaultAnimation?.motion || name === `${config.defaultAnimation?.motion}.motion3.json`;
        });
        if (motionConfig) {
          const group = typeof motionConfig === 'string' ? 'idle' : motionConfig.group || 'idle';
          const normalizedGroup = group === 'default' ? 'idle' : group; // 支持'default'组
          const groupMotions =
            config.motions?.filter((m: any) => {
              const mGroup = typeof m === 'string' ? 'idle' : m.group || 'idle';
              const normalizedMGroup = mGroup === 'default' ? 'idle' : mGroup;
              return normalizedMGroup === normalizedGroup || mGroup === group;
            }) || [];
          const motionIndex = groupMotions.findIndex((m: any) => {
            const name = typeof m === 'string' ? m : m.name || m.file;
            return (
              name === config.defaultAnimation?.motion || name === `${config.defaultAnimation?.motion}.motion3.json`
            );
          });
          if (motionIndex >= 0) {
            // 使用 NORMAL 优先级播放（默认）
            const MotionPriority = window.Live2DModel?.MotionPriority || { NORMAL: 2 };
            model.motion(normalizedGroup, motionIndex, MotionPriority.NORMAL);
            console.info(`播放默认动作（不循环）: ${config.defaultAnimation.motion}`);
          }
        }
      }

      console.info(`模型 "${config.name}" 加载成功`);
    } catch (error) {
      console.error('加载模型失败:', error);
      throw new Error(`加载模型失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 启动默认动作循环播放
   * 使用 MotionPriority.IDLE 优先级，可以被 NORMAL 和 FORCE 优先级的动作打断
   * 当其他动作完成后，如果默认动作循环仍在运行，会自动恢复播放
   */
  private startDefaultMotionLoop(motionName: string): void {
    // 停止之前的循环
    this.stopDefaultMotionLoop();

    if (!this.currentModel || !this.modelConfig) {
      return;
    }

    // 获取 MotionPriority 枚举
    const MotionPriority = window.Live2DModel?.MotionPriority || {
      NONE: 0,
      IDLE: 1,
      NORMAL: 2,
      FORCE: 3,
    };

    // 查找默认动作
    const motionConfig = this.modelConfig.motions?.find((m: any) => {
      const name = typeof m === 'string' ? m : m.name || m.file;
      return name === motionName || name === `${motionName}.motion3.json`;
    });

    if (!motionConfig) {
      console.warn(`未找到默认动作: ${motionName}`);
      return;
    }

    const group = typeof motionConfig === 'string' ? 'idle' : motionConfig.group || 'idle';
    // 如果group是'default'，转换为'idle'（因为pixi-live2d-display通常使用'idle'作为默认组）
    const normalizedGroup = group === 'default' ? 'idle' : group;

    // 查找该组中所有动作的索引（支持'default'组）
    const groupMotions =
      this.modelConfig.motions?.filter((m: any) => {
        const mGroup = typeof m === 'string' ? 'idle' : m.group || 'idle';
        const normalizedMGroup = mGroup === 'default' ? 'idle' : mGroup;
        return normalizedMGroup === normalizedGroup || mGroup === group; // 同时匹配标准化和原始组名
      }) || [];

    if (groupMotions.length === 0) {
      console.warn(`动作组 ${group} 中没有找到动作`);
      return;
    }

    // 找到当前动作在组中的索引
    const motionIndex = groupMotions.findIndex((m: any) => {
      const name = typeof m === 'string' ? m : m.name || m.file;
      return name === motionName || name === `${motionName}.motion3.json`;
    });

    if (motionIndex === -1) {
      console.warn(`在动作组 ${group} 中未找到动作 ${motionName}`);
      return;
    }

    this.currentMotionGroup = normalizedGroup;
    this.currentMotionIndex = motionIndex;
    this.isLoopingDefaultMotion = true;

    // 播放默认动作循环
    const playDefaultMotionLoop = async () => {
      if (!this.isLoopingDefaultMotion || !this.currentModel || this.currentMotionGroup === null) {
        return;
      }

      try {
        // 检查是否有更高优先级的动作正在播放
        const motionManager = this.currentModel.motionManager;
        if (motionManager && motionManager.state) {
          const state = motionManager.state;
          // 如果当前有 NORMAL 或 FORCE 优先级的动作正在播放，等待它完成
          if (state.currentPriority === MotionPriority.NORMAL || state.currentPriority === MotionPriority.FORCE) {
            // 使用定时器等待更高优先级的动作完成
            const waitInterval = setInterval(() => {
              if (!this.isLoopingDefaultMotion || !this.currentModel || this.currentMotionGroup === null) {
                clearInterval(waitInterval);
                return;
              }

              const currentState = this.currentModel.motionManager?.state;
              if (
                !currentState ||
                (currentState.currentPriority !== MotionPriority.NORMAL &&
                  currentState.currentPriority !== MotionPriority.FORCE)
              ) {
                // 更高优先级的动作已完成或被停止，可以播放默认动作了
                clearInterval(waitInterval);
                playDefaultMotionLoop();
              }
            }, 100); // 每100ms检查一次

            return;
          }
        }

        // 使用 IDLE 优先级播放默认动作
        // IDLE 优先级较低，可以被 NORMAL 和 FORCE 优先级的动作打断
        const success = await this.currentModel.motion(
          this.currentMotionGroup,
          this.currentMotionIndex,
          MotionPriority.IDLE,
        );

        if (!success) {
          console.warn(`播放默认动作失败: ${motionName}`);
          // 延迟后重试
          setTimeout(() => {
            if (this.isLoopingDefaultMotion && this.currentModel && this.currentMotionGroup !== null) {
              playDefaultMotionLoop();
            }
          }, 2000);
          return;
        }

        console.info(
          `播放默认动作（IDLE优先级）: ${motionName} (组=${this.currentMotionGroup}, 索引=${this.currentMotionIndex})`,
        );

        // 使用定时器定期检查动作状态，判断是否完成
        // 默认动作通常持续 2-4 秒，我们每100ms检查一次状态
        let checkCount = 0;
        const maxChecks = 50; // 最多检查5秒（50 * 100ms）

        const checkInterval = setInterval(() => {
          checkCount++;
          if (!this.isLoopingDefaultMotion || !this.currentModel || this.currentMotionGroup === null) {
            clearInterval(checkInterval);
            return;
          }

          try {
            const motionManager = this.currentModel.motionManager;
            if (motionManager && motionManager.state) {
              const state = motionManager.state;

              // 检查当前动作状态
              const isOurDefaultMotion =
                state.currentGroup === this.currentMotionGroup &&
                state.currentIndex === this.currentMotionIndex &&
                state.currentPriority === MotionPriority.IDLE;

              if (isOurDefaultMotion) {
                // 仍然是我们的默认动作在播放，继续等待
                if (checkCount >= maxChecks) {
                  // 超时，假设动作已完成，继续下一个循环
                  clearInterval(checkInterval);
                  playDefaultMotionLoop();
                }
                return;
              } else {
                // 动作已完成或被其他动作打断
                clearInterval(checkInterval);

                // 如果是被更高优先级的动作打断，等待它完成后再继续
                if (state.currentPriority === MotionPriority.NORMAL || state.currentPriority === MotionPriority.FORCE) {
                  // 等待更高优先级的动作完成（使用另一个定时器）
                  const waitHighPriority = setInterval(() => {
                    if (!this.isLoopingDefaultMotion || !this.currentModel || this.currentMotionGroup === null) {
                      clearInterval(waitHighPriority);
                      return;
                    }

                    const currentState = this.currentModel.motionManager?.state;
                    if (
                      !currentState ||
                      (currentState.currentPriority !== MotionPriority.NORMAL &&
                        currentState.currentPriority !== MotionPriority.FORCE)
                    ) {
                      // 更高优先级的动作已完成，继续播放默认动作
                      clearInterval(waitHighPriority);
                      playDefaultMotionLoop();
                    }
                  }, 100);
                } else {
                  // 动作已完成，继续播放下一个循环
                  playDefaultMotionLoop();
                }
              }
            }

            // 如果没有 MotionManager，使用固定延时
            if (checkCount >= 30) {
              // 3秒后假设动作完成
              clearInterval(checkInterval);
              playDefaultMotionLoop();
            }
          } catch (error) {
            console.warn('检查动作状态失败:', error);
            clearInterval(checkInterval);
            // 出错时使用延时等待后继续
            setTimeout(() => {
              if (this.isLoopingDefaultMotion && this.currentModel && this.currentMotionGroup !== null) {
                playDefaultMotionLoop();
              }
            }, 3000);
          }
        }, 100); // 每100ms检查一次

        // 记录定时器，以便在停止循环时清理
        this.defaultMotionLoopTimer = checkInterval as any;
      } catch (error) {
        console.warn('循环播放默认动作失败:', error);
        this.stopDefaultMotionLoop();
      }
    };

    // 立即播放第一次
    playDefaultMotionLoop();
    console.info(`开始循环播放默认动作: ${motionName} (组=${normalizedGroup}, 索引=${motionIndex}, 优先级=IDLE)`);
  }

  /**
   * 停止默认动作循环播放
   */
  private stopDefaultMotionLoop(): void {
    // 设置标志，停止循环
    this.isLoopingDefaultMotion = false;
    this.currentMotionGroup = null;
    this.currentMotionIndex = 0;

    // 清除定时器（如果有）
    if (this.defaultMotionLoopTimer) {
      clearInterval(this.defaultMotionLoopTimer);
      this.defaultMotionLoopTimer = null;
    }
  }

  /**
   * 播放动作
   * 使用 NORMAL 优先级，可以打断 IDLE 优先级的默认动作
   * 当动作完成后，如果默认动作循环仍在运行，会自动恢复播放
   */
  playMotion(group: string, index: number, priority?: number): void {
    if (!this.currentModel) {
      console.warn('没有加载的模型');
      return;
    }

    try {
      // 获取 MotionPriority 枚举
      const MotionPriority = window.Live2DModel?.MotionPriority || {
        NONE: 0,
        IDLE: 1,
        NORMAL: 2,
        FORCE: 3,
      };

      // 使用 NORMAL 优先级播放（默认），可以打断 IDLE 优先级的默认动作
      // 不停止默认动作循环，这样动作完成后可以自动恢复默认动作
      const motionPriority = priority !== undefined ? priority : MotionPriority.NORMAL;
      this.currentModel.motion(group || '', index, motionPriority);
      console.info(`播放动作: 组="${group}", 索引=${index}, 优先级=${motionPriority}`);

      // 注意：pixi-live2d-display 会自动处理动作之间的层级和打断关系
      // NORMAL 优先级的动作会打断 IDLE 优先级的默认动作
      // 当 NORMAL 优先级的动作完成后，默认动作循环会自动恢复（如果还在运行）
    } catch (error) {
      console.error('播放动作失败:', error);
    }
  }

  /**
   * 播放表情
   */
  playExpression(expressionIndex: number): void {
    if (!this.currentModel) {
      console.warn('没有加载的模型');
      return;
    }

    try {
      this.currentModel.expression(expressionIndex);
      console.info(`播放表情: 索引=${expressionIndex}`);
    } catch (error) {
      console.error('播放表情失败:', error);
    }
  }

  /**
   * 设置模型位置
   */
  setPosition(x: number, y: number): void {
    if (this.currentModel) {
      this.currentModel.x = x;
      this.currentModel.y = y;
    }
  }

  /**
   * 设置模型缩放
   */
  setScale(scale: number): void {
    if (this.currentModel) {
      this.currentModel.scale.set(scale);
    }
  }

  /**
   * 获取当前模型
   */
  getModel(): any {
    return this.currentModel;
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 卸载模型
   */
  unloadModel(): void {
    // 停止默认动作循环
    this.stopDefaultMotionLoop();

    if (this.currentModel && this.app) {
      this.app.stage.removeChild(this.currentModel);
      this.currentModel.destroy();
      this.currentModel = null;
      this.modelConfig = null;
    }
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    // 停止默认动作循环
    this.stopDefaultMotionLoop();
    this.unloadModel();

    if (this.app) {
      this.app.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true,
      });
      this.app = null;
    }

    this.isInitialized = false;
  }

  /**
   * 调整画布大小
   */
  resize(width: number, height: number): void {
    if (this.app) {
      this.app.renderer.resize(width, height);

      if (this.currentModel) {
        this.currentModel.x = width / 2;
        this.currentModel.y = height / 2;
      }
    }
  }
}
