/**
 * Live2D模型渲染器
 * 采用 Cubism SDK 5 方案，支持 Cubism 3/4/5 模型
 *
 * 实现说明：
 * - 使用 Cubism Core（从 CDN 加载）
 * - 使用 Cubism SDK Framework（通过别名引用）
 * - 支持 Cubism 3 模型（.model3.json）
 * - 使用原生 WebGL 渲染
 */

import { getIndexedDbFileUrl } from '../../utils/indexedDB';
import { CubismAdapter } from './cubism/CubismAdapter';
import { PriorityNormal } from './cubism/LAppDefine';
import { LAppPal } from './cubism/LAppPal';
import { ModelManager } from './cubism/ModelManager';

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

// Cubism Core 类型声明
declare global {
  interface Window {
    Live2DCubismCore?: any;
    CubismCore?: any;
  }
}

// 动态加载脚本
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      setTimeout(() => resolve(), 100);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      setTimeout(() => resolve(), 100);
    };
    script.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
    document.head.appendChild(script);
  });
}

// 初始化 Cubism Core
let cubismCoreInitPromise: Promise<void> | null = null;

async function initCubismCore(): Promise<void> {
  if (cubismCoreInitPromise) return cubismCoreInitPromise;

  cubismCoreInitPromise = (async () => {
    try {
      // 加载 Cubism Core（Cubism 3/4/5 运行时）
      // 使用官方 CDN
      if (!window.Live2DCubismCore && !window.CubismCore) {
        await loadScript('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js');
        console.info('✅ Cubism Core 加载成功');
      } else {
        console.info('✅ Cubism Core 已存在');
      }
    } catch (error) {
      cubismCoreInitPromise = null;
      console.error('Cubism Core 加载失败:', error);
      throw error;
    }
  })();

  return cubismCoreInitPromise;
}

// 初始化 Cubism Framework 已移至 CubismAdapter

/**
 * Live2D 渲染器类
 * 使用 Cubism SDK 加载和渲染 Live2D 模型
 */
export class Live2DRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private _modelConfig: Live2DModelConfig | null = null;
  private isInitialized = false;
  private _currentModelUrl: string | null = null;
  private _model: any = null; // LAppModel 实例
  private _modelManager: ModelManager | null = null; // 模型管理器
  private _renderer: any = null; // CubismRenderer 实例
  private _animationFrameId: number | null = null;
  private _lastUpdateTime: number = 0;
  private _motionManager: any = null; // 动作管理器
  private _expressionManager: any = null; // 表情管理器
  private _modelMatrix: any = null; // 模型变换矩阵
  private _projectionMatrix: any = null; // 投影矩阵
  private _viewMatrix: any = null; // 视图矩阵
  private _scale: number = 1.0;
  private _positionX: number = 0;
  private _positionY: number = 0;

  // 用于消除未使用变量的警告（这些变量将在后续实现中使用）
  // 在构造函数或方法中调用此方法以消除警告
  private _usePrivateVars(): void {
    // 这些变量将在后续实现中使用
    void this._currentModelUrl;
    void this._renderer;
    void this._lastUpdateTime;
    void this._motionManager;
    void this._expressionManager;
    void this._modelMatrix;
    void this._viewMatrix;
    void this._scale;
    void this._positionX;
    void this._positionY;
    void this._waitForModelLoad;
  }

  constructor() {
    // 调用以消除未使用变量警告
    this._usePrivateVars();
  }
  private _subdelegate: any = null; // LAppSubdelegate 实例（用于管理模型）

  /**
   * 初始化渲染器
   */
  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.info('[Live2DRenderer] 开始初始化，canvas:', {
        exists: !!canvas,
        width: canvas?.width || canvas?.clientWidth,
        height: canvas?.height || canvas?.clientHeight,
      });

      // 加载 Cubism Core
      console.info('[Live2DRenderer] 开始加载 Cubism Core...');
      await initCubismCore();
      console.info('[Live2DRenderer] Cubism Core 加载完成');

      // 初始化 Cubism Framework
      console.info('[Live2DRenderer] 开始初始化 Cubism Framework...');
      await CubismAdapter.initialize();
      console.info('[Live2DRenderer] Cubism Framework 初始化完成');

      this.canvas = canvas;

      // 获取 WebGL 上下文
      const gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
      }) as WebGLRenderingContext | null;

      if (!gl) {
        throw new Error('无法获取 WebGL 上下文');
      }

      this.gl = gl;

      // 设置 WebGL 状态
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);

      // 设置画布大小
      const resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      resizeObserver.observe(canvas);

      // 尝试创建 LAppSubdelegate（如果 Framework 可用）
      // 注意：由于路径问题，暂时跳过，后续可以复制必要的文件到项目中
      // try {
      //   const { LAppSubdelegate } = await import('../../初始模板/CubismSdkForWeb-5-r.4/Samples/TypeScript/Demo/src/lappsubdelegate');
      //   this._subdelegate = new LAppSubdelegate();
      //   if (this._subdelegate.initialize(canvas)) {
      //     console.info('[Live2DRenderer] LAppSubdelegate 初始化成功');
      //   }
      // } catch (error) {
      //   console.warn('[Live2DRenderer] 无法加载 LAppSubdelegate，将使用简化实现:', error);
      // }

      this.isInitialized = true;
      console.info('[Live2DRenderer] Live2D渲染器初始化成功');
    } catch (error) {
      console.error('Live2D渲染器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载模型
   */
  async loadModel(config: Live2DModelConfig): Promise<void> {
    if (!this.isInitialized || !this.canvas || !this.gl) {
      throw new Error('渲染器未初始化');
    }

    try {
      this._modelConfig = config;

      // 构建完整的模型路径
      let modelUrl = config.modelPath;
      if (!modelUrl.startsWith('http://') && !modelUrl.startsWith('https://')) {
        modelUrl = config.basePath ? `${config.basePath}${modelUrl}` : modelUrl;
      }

      // 检查是否是 IndexedDB 存储的本地文件
      if (modelUrl.startsWith('indexeddb://')) {
        console.info(`[Live2DRenderer] 检测到 IndexedDB 协议，从本地存储加载: ${modelUrl}`);
        const blobUrl = await getIndexedDbFileUrl(modelUrl, config._fileIds);
        if (!blobUrl) {
          throw new Error(`无法从 IndexedDB 读取文件: ${modelUrl}`);
        }
        modelUrl = blobUrl;
      }

      console.info(`[Live2DRenderer] 正在加载模型: ${modelUrl}`);

      // 提取模型目录路径
      const modelDir = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1);

      // 使用 ModelManager 加载模型
      try {
        this._modelManager = new ModelManager();
        await this._modelManager.initialize(this.canvas, this.gl, modelUrl, modelDir);
        this._model = this._modelManager.getModel();
        this._currentModelUrl = modelUrl;
        console.info(`[Live2DRenderer] 模型 "${config.name}" 加载成功`);
      } catch (error) {
        console.error('[Live2DRenderer] 模型加载失败:', error);
        // 如果 ModelManager 加载失败，使用简化实现
        this._currentModelUrl = modelUrl;
        throw error;
      }

      // 启动渲染循环
      this.startRenderLoop();

      // 播放默认动画（如果有）
      if (config.defaultAnimation) {
        if (config.defaultAnimation.motion) {
          const motionIndex = config.motions.findIndex(
            m => m.name === config.defaultAnimation?.motion || m.file === config.defaultAnimation?.motion,
          );
          if (motionIndex >= 0) {
            const motionGroup = config.motions[motionIndex].group || 'idle';
            this.playMotion(motionGroup, motionIndex);
          }
        }
        if (config.defaultAnimation.expression) {
          const expressionIndex = config.expressions.findIndex(
            e => e === config.defaultAnimation?.expression || e.includes(config.defaultAnimation?.expression || ''),
          );
          if (expressionIndex >= 0) {
            this.playExpression(expressionIndex);
          }
        }
      }
    } catch (error) {
      console.error('加载模型失败:', error);
      throw new Error(`加载模型失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 等待模型加载完成（用于 LAppModel）
   */
  private async _waitForModelLoad(): Promise<void> {
    if (!this._model) return;

    // 轮询检查模型是否加载完成
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 300; // 最多等待 30 秒

      const checkLoad = () => {
        attempts++;

        // 检查模型是否已加载（需要根据 LAppModel 的实际实现调整）
        if (this._model && this._model.getModel && this._model.getModel()) {
          resolve();
          return;
        }

        if (attempts >= maxAttempts) {
          reject(new Error('模型加载超时'));
          return;
        }

        setTimeout(checkLoad, 100);
      };

      checkLoad();
    });
  }

  /**
   * 启动渲染循环
   */
  private startRenderLoop(): void {
    if (this._animationFrameId !== null) {
      return; // 已经在运行
    }

    const render = () => {
      if (!this.canvas || !this.gl) {
        return;
      }

      // 更新时间
      LAppPal.updateTime();

      // 更新模型
      this.update();

      // 渲染模型
      this.render();

      this._animationFrameId = requestAnimationFrame(render);
    };

    this._lastUpdateTime = Date.now();
    this._animationFrameId = requestAnimationFrame(render);
  }

  /**
   * 停止渲染循环
   */
  private stopRenderLoop(): void {
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  /**
   * 更新模型状态
   */
  private update(): void {
    if (this._modelManager && this._modelManager.isLoaded()) {
      const deltaTime = LAppPal.getDeltaTime();
      this._modelManager.update(deltaTime);
    } else if (this._model && typeof this._model.update === 'function') {
      // 如果模型有 update 方法，调用它
      this._model.update();
    }
  }

  /**
   * 渲染模型
   */
  private render(): void {
    if (!this.canvas || !this.gl) {
      return;
    }

    const gl = this.gl;

    // 清除画布
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 使用 ModelManager 渲染模型
    if (this._modelManager && this._modelManager.isLoaded()) {
      this._modelManager.render();
      return;
    }

    // 如果模型有 draw 方法，调用它
    if (this._model && typeof this._model.draw === 'function' && this._projectionMatrix) {
      this._model.draw(this._projectionMatrix);
      return;
    }

    if (this._subdelegate && typeof this._subdelegate.update === 'function') {
      // 使用 Subdelegate 的更新方法
      this._subdelegate.update();
      return;
    }
  }

  /**
   * 播放动作
   */
  playMotion(group: string, index: number, priority?: number): void {
    console.info(`[Live2DRenderer] 播放动作: 组="${group}", 索引=${index}, 优先级=${priority || PriorityNormal}`);

    // 优先使用 ModelManager
    if (this._modelManager && this._modelManager.isLoaded()) {
      this._modelManager.playMotion(group, index, priority || PriorityNormal);
      return;
    }

    // 如果模型有 startMotion 方法，调用它
    if (this._model && typeof this._model.startMotion === 'function') {
      this._model.startMotion(group, index, priority || PriorityNormal);
    } else if (this._model && typeof this._model.startRandomMotion === 'function') {
      // 如果没有指定索引，使用随机动作
      this._model.startRandomMotion(group, priority || PriorityNormal);
    } else {
      console.warn('[Live2DRenderer] 模型未加载，无法播放动作');
    }
  }

  /**
   * 播放表情
   */
  playExpression(expressionIndex: number): void {
    console.info(`[Live2DRenderer] 播放表情: 索引=${expressionIndex}`);

    // 优先使用 ModelManager
    if (this._modelManager && this._modelManager.isLoaded()) {
      this._modelManager.playExpression(expressionIndex);
      return;
    }

    // 如果模型有 setExpression 方法，调用它
    if (this._model && typeof this._model.setExpression === 'function') {
      // 需要根据 expressionIndex 获取表情名称
      const expressionName = this._modelConfig?.expressions[expressionIndex];
      if (expressionName) {
        this._model.setExpression(expressionName);
      }
    } else {
      console.warn('[Live2DRenderer] 模型未加载，无法播放表情');
    }
  }

  /**
   * 设置模型位置
   */
  setPosition(x: number, y: number): void {
    this._positionX = x;
    this._positionY = y;

    // 更新模型矩阵（如果 ModelManager 可用）
    if (this._modelManager && this._modelManager.isLoaded()) {
      // ModelManager 内部会处理位置更新
      // 这里可以通过模型矩阵来设置位置
      const model = this._modelManager.getModel();
      if (model && model.getModelMatrix) {
        const modelMatrix = model.getModelMatrix();
        // 将百分比坐标转换为模型坐标系
        // x, y 是 0-100 的百分比，需要转换为 -1 到 1 的 NDC 坐标
        const ndcX = (x / 100) * 2 - 1;
        const ndcY = (1 - y / 100) * 2 - 1; // Y轴反转
        modelMatrix.setX(ndcX);
        modelMatrix.setY(ndcY);
      }
    }
  }

  /**
   * 设置模型缩放
   */
  setScale(scale: number): void {
    this._scale = scale;

    // 更新模型矩阵（如果 ModelManager 可用）
    if (this._modelManager && this._modelManager.isLoaded()) {
      const model = this._modelManager.getModel();
      if (model && model.getModelMatrix) {
        const modelMatrix = model.getModelMatrix();
        modelMatrix.setScale(scale);
      }
    }
  }

  /**
   * 获取当前模型
   */
  getModel(): any {
    return this._model;
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
    this.stopRenderLoop();

    // 释放 ModelManager
    if (this._modelManager) {
      this._modelManager.release();
      this._modelManager = null;
    }

    if (this._model && typeof this._model.release === 'function') {
      this._model.release();
    }

    this._currentModelUrl = null;
    this._modelConfig = null;
    this._model = null;
    this._renderer = null;
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    this.unloadModel();

    if (this._subdelegate && typeof this._subdelegate.release === 'function') {
      this._subdelegate.release();
      this._subdelegate = null;
    }

    if (this.gl) {
      const loseContext = this.gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
      this.gl = null;
    }

    this.canvas = null;
    this.isInitialized = false;
  }

  /**
   * 调整画布大小
   */
  resize(width?: number, height?: number): void {
    if (!this.canvas || !this.gl) return;

    const displayWidth = width || this.canvas.clientWidth;
    const displayHeight = height || this.canvas.clientHeight;

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.gl.viewport(0, 0, displayWidth, displayHeight);
    }

    // 通知 Subdelegate 调整大小
    if (this._subdelegate && typeof this._subdelegate.onResize === 'function') {
      this._subdelegate.onResize();
    }
  }
}
