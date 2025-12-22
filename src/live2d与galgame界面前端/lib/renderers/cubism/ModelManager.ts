/**
 * Live2D 模型管理器
 * 使用 Cubism SDK Framework 加载和管理模型
 */

import { LAppPal } from './LAppPal';
import { PriorityNormal } from './LAppDefine';

// 模型加载状态
enum ModelState {
  NotLoaded,
  Loading,
  Loaded,
  Error,
}

/**
 * Live2D 模型管理器
 * 封装模型加载、动作播放、表情播放等功能
 */
export class ModelManager {
  private _model: any = null; // CubismModel 实例
  private _modelSetting: any = null; // CubismModelSettingJson 实例
  private _renderer: any = null; // CubismRenderer 实例
  private _motionManager: any = null; // CubismMotionManager 实例
  private _expressionManager: any = null; // CubismExpressionMotionManager 实例
  private _modelHomeDir: string = '';
  private _state: ModelState = ModelState.NotLoaded;
  private _gl: WebGLRenderingContext | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _motions: Map<string, any> = new Map(); // 预加载的动作
  private _expressions: Map<string, any> = new Map(); // 预加载的表情
  private _modelMatrix: any = null; // 模型变换矩阵
  private _projectionMatrix: any = null; // 投影矩阵

  /**
   * 初始化模型管理器
   */
  async initialize(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    modelUrl: string,
    basePath: string,
  ): Promise<void> {
    this._canvas = canvas;
    this._gl = gl;
    this._modelHomeDir = basePath.endsWith('/') ? basePath : basePath + '/';
    this._state = ModelState.Loading;

    try {
      // 加载 model3.json
      const modelSetting = await this.loadModelSetting(modelUrl);
      this._modelSetting = modelSetting;

      // 初始化 Cubism Framework（如果还未初始化）
      await this.ensureCubismFramework();

      // 加载模型数据
      await this.loadModelData();

      // 加载纹理
      await this.loadTextures();

      // 预加载动作和表情
      await this.preloadMotions();
      await this.preloadExpressions();

      this._state = ModelState.Loaded;
      console.info('[ModelManager] 模型加载完成');
    } catch (error) {
      this._state = ModelState.Error;
      console.error('[ModelManager] 模型加载失败:', error);
      throw error;
    }
  }

  /**
   * 加载 model3.json
   */
  private async loadModelSetting(modelUrl: string): Promise<any> {
    return new Promise((resolve, reject) => {
      LAppPal.loadFileAsBytes(modelUrl, (arrayBuffer, size) => {
        if (size === 0) {
          reject(new Error('Failed to load model3.json'));
          return;
        }

        try {
          // 使用 Cubism SDK 的 CubismModelSettingJson
          // 动态导入 Framework
          import('@framework/cubismmodelsettingjson')
            .then(module => {
              const { CubismModelSettingJson } = module;
              const setting = new CubismModelSettingJson(arrayBuffer, size);
              resolve(setting);
            })
            .catch(() => {
              // 如果 Framework 不可用，使用 JSON 解析作为后备
              const json = JSON.parse(new TextDecoder().decode(arrayBuffer));
              resolve(json);
            });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * 确保 Cubism Framework 已初始化
   */
  private async ensureCubismFramework(): Promise<void> {
    try {
      const { CubismAdapter } = await import('./CubismAdapter');
      await CubismAdapter.initialize();
    } catch (error) {
      console.warn('[ModelManager] Cubism Framework 初始化失败:', error);
    }
  }

  /**
   * 加载模型数据（.moc3 文件）
   */
  private async loadModelData(): Promise<void> {
    if (!this._modelSetting || !this._gl) {
      throw new Error('Model setting or GL context not available');
    }

    try {
      // 使用 Cubism SDK 加载 .moc3 文件
      const frameworkModule = await import('@framework/model/cubismmoc');
      const { CubismMoc } = frameworkModule;

      const modelFileName = this._modelSetting.getModelFileName();
      if (!modelFileName) {
        throw new Error('Model file name not found in setting');
      }

      // 加载 .moc3 文件
      return new Promise((resolve, reject) => {
        LAppPal.loadFileAsBytes(`${this._modelHomeDir}${modelFileName}`, async (arrayBuffer, size) => {
          if (size === 0) {
            reject(new Error('Failed to load .moc3 file'));
            return;
          }

          try {
            // 创建 MOC
            const moc = CubismMoc.create(arrayBuffer, size);
            if (!moc) {
              reject(new Error('Failed to create MOC'));
              return;
            }

            // 创建模型
            const modelModule = await import('@framework/model/cubismmodel');
            const { CubismModel } = modelModule;
            this._model = CubismModel.create(moc);
            if (!this._model) {
              reject(new Error('Failed to create model'));
              return;
            }

            // 创建渲染器
            const rendererModule = await import('@framework/rendering/cubismrenderer_webgl');
            const { CubismRenderer_WebGL } = rendererModule;
            this._renderer = new CubismRenderer_WebGL();
            this._renderer.startUp(this._gl);

            // 创建动作管理器
            const motionModule = await import('@framework/motion/cubismmotionmanager');
            const { CubismMotionManager } = motionModule;
            this._motionManager = new CubismMotionManager();

            // 创建表情管理器
            const expressionModule = await import('@framework/motion/cubismexpressionmotionmanager');
            const { CubismExpressionMotionManager } = expressionModule;
            this._expressionManager = new CubismExpressionMotionManager();

            // 创建模型矩阵
            const mathModule = await import('@framework/math/cubismmodelmatrix');
            const { CubismModelMatrix } = mathModule;
            this._modelMatrix = new CubismModelMatrix(this._model.getCanvasWidth(), this._model.getCanvasHeight());

            // 创建投影矩阵
            const matrixModule = await import('@framework/math/cubismmatrix44');
            const { CubismMatrix44 } = matrixModule;
            this._projectionMatrix = new CubismMatrix44();

            console.info('[ModelManager] 模型数据加载完成');
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.warn('[ModelManager] 无法使用 Cubism SDK，将使用简化实现:', error);
      // 使用简化实现
    }
  }

  /**
   * 加载纹理
   */
  private async loadTextures(): Promise<void> {
    if (!this._modelSetting || !this._gl || !this._renderer) {
      return;
    }

    try {
      const textureCount = this._modelSetting.getTextureCount();
      let loadedCount = 0;

      for (let i = 0; i < textureCount; i++) {
        const textureFileName = this._modelSetting.getTextureFileName(i);
        if (!textureFileName) {
          continue;
        }

        const texturePath = `${this._modelHomeDir}${textureFileName}`;

        // 加载纹理图片
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              // 创建 WebGL 纹理
              const texture = this._gl!.createTexture();
              if (!texture) {
                reject(new Error('Failed to create texture'));
                return;
              }

              this._gl!.bindTexture(this._gl!.TEXTURE_2D, texture);
              this._gl!.texParameteri(
                this._gl!.TEXTURE_2D,
                this._gl!.TEXTURE_MIN_FILTER,
                this._gl!.LINEAR_MIPMAP_LINEAR,
              );
              this._gl!.texParameteri(this._gl!.TEXTURE_2D, this._gl!.TEXTURE_MAG_FILTER, this._gl!.LINEAR);
              this._gl!.pixelStorei(this._gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
              this._gl!.texImage2D(
                this._gl!.TEXTURE_2D,
                0,
                this._gl!.RGBA,
                this._gl!.RGBA,
                this._gl!.UNSIGNED_BYTE,
                img,
              );
              this._gl!.generateMipmap(this._gl!.TEXTURE_2D);
              this._gl!.bindTexture(this._gl!.TEXTURE_2D, null);

              // 绑定纹理到渲染器
              this._renderer.bindTexture(i, texture);

              loadedCount++;
              if (loadedCount >= textureCount) {
                console.info('[ModelManager] 所有纹理加载完成');
              }
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          img.onerror = () => {
            console.warn(`[ModelManager] 纹理加载失败: ${texturePath}`);
            loadedCount++;
            resolve(); // 即使失败也继续
          };
          img.src = texturePath;
        });
      }
    } catch (error) {
      console.warn('[ModelManager] 纹理加载过程出错:', error);
    }
  }

  /**
   * 预加载动作
   */
  private async preloadMotions(): Promise<void> {
    if (!this._modelSetting) {
      return;
    }

    try {
      // 获取所有动作组
      const motionGroupCount = this._modelSetting.getMotionGroupCount();
      for (let i = 0; i < motionGroupCount; i++) {
        const groupName = this._modelSetting.getMotionGroupName(i);
        const motionCount = this._modelSetting.getMotionCount(groupName);

        // 预加载每个动作（可选，按需加载）
        // 这里暂时不预加载，在播放时再加载
        console.info(`[ModelManager] 发现动作组: ${groupName}, 动作数量: ${motionCount}`);
      }
    } catch (error) {
      console.warn('[ModelManager] 预加载动作失败:', error);
    }
  }

  /**
   * 预加载表情
   */
  private async preloadExpressions(): Promise<void> {
    if (!this._modelSetting) {
      return;
    }

    try {
      // 获取所有表情
      const expressionCount = this._modelSetting.getExpressionCount();
      console.info(`[ModelManager] 发现表情数量: ${expressionCount}`);

      // 预加载所有表情（可选）
      for (let i = 0; i < expressionCount; i++) {
        const expressionName = this._modelSetting.getExpressionName(i);
        const expressionFileName = this._modelSetting.getExpressionFileName(i);

        // 预加载表情文件
        LAppPal.loadFileAsBytes(`${this._modelHomeDir}${expressionFileName}`, (arrayBuffer, size) => {
          if (size === 0) {
            console.warn(`[ModelManager] 无法加载表情文件: ${expressionFileName}`);
            return;
          }

          try {
            import('@framework/motion/cubismexpressionmotion')
              .then(({ CubismExpressionMotion }) => {
                const expression = CubismExpressionMotion.create(arrayBuffer, size);
                if (expression) {
                  this._expressions.set(expressionName, expression);
                  console.info(`[ModelManager] 预加载表情: ${expressionName}`);
                }
              })
              .catch(error => {
                console.warn(`[ModelManager] 预加载表情失败: ${expressionName}`, error);
              });
          } catch (error) {
            console.warn(`[ModelManager] 预加载表情失败: ${expressionName}`, error);
          }
        });
      }
    } catch (error) {
      console.warn('[ModelManager] 预加载表情失败:', error);
    }
  }

  /**
   * 播放动作
   */
  playMotion(group: string, index: number, priority: number = PriorityNormal): void {
    if (this._state !== ModelState.Loaded) {
      console.warn('[ModelManager] 模型未加载，无法播放动作');
      return;
    }

    if (!this._motionManager || !this._modelSetting) {
      console.warn('[ModelManager] 动作管理器未初始化');
      return;
    }

    try {
      const motionFileName = this._modelSetting.getMotionFileName(group, index);
      if (!motionFileName) {
        console.warn(`[ModelManager] 动作文件不存在: ${group}_${index}`);
        return;
      }

      const motionKey = `${group}_${index}`;
      let motion = this._motions.get(motionKey);

      if (!motion) {
        // 加载动作文件
        LAppPal.loadFileAsBytes(`${this._modelHomeDir}${motionFileName}`, (arrayBuffer, size) => {
          if (size === 0) {
            console.error(`[ModelManager] 无法加载动作文件: ${motionFileName}`);
            return;
          }

          try {
            import('@framework/motion/cubismmotion')
              .then(({ CubismMotion }) => {
                motion = CubismMotion.create(arrayBuffer, size, null);
                if (motion) {
                  this._motions.set(motionKey, motion);
                  this._motionManager.startMotionPriority(motion, false, priority);
                  console.info(`[ModelManager] 播放动作: ${motionKey}`);
                }
              })
              .catch(error => {
                console.error(`[ModelManager] 创建动作失败:`, error);
              });
          } catch (error) {
            console.error(`[ModelManager] 创建动作失败:`, error);
          }
        });
      } else {
        // 使用已加载的动作
        this._motionManager.startMotionPriority(motion, false, priority);
        console.info(`[ModelManager] 播放动作: ${motionKey}`);
      }
    } catch (error) {
      console.error('[ModelManager] 播放动作失败:', error);
    }
  }

  /**
   * 播放表情
   */
  playExpression(expressionIndex: number): void {
    if (this._state !== ModelState.Loaded) {
      console.warn('[ModelManager] 模型未加载，无法播放表情');
      return;
    }

    if (!this._expressionManager || !this._modelSetting) {
      console.warn('[ModelManager] 表情管理器未初始化');
      return;
    }

    try {
      const expressionName = this._modelSetting.getExpressionName(expressionIndex);
      if (!expressionName) {
        console.warn(`[ModelManager] 表情不存在: ${expressionIndex}`);
        return;
      }

      let expression = this._expressions.get(expressionName);

      if (!expression) {
        // 加载表情文件
        const expressionFileName = this._modelSetting.getExpressionFileName(expressionIndex);
        LAppPal.loadFileAsBytes(`${this._modelHomeDir}${expressionFileName}`, (arrayBuffer, size) => {
          if (size === 0) {
            console.error(`[ModelManager] 无法加载表情文件: ${expressionFileName}`);
            return;
          }

          try {
            import('@framework/motion/cubismexpressionmotion')
              .then(({ CubismExpressionMotion }) => {
                expression = CubismExpressionMotion.create(arrayBuffer, size);
                if (expression) {
                  this._expressions.set(expressionName, expression);
                  this._expressionManager.startMotion(expression, false);
                  console.info(`[ModelManager] 播放表情: ${expressionName}`);
                }
              })
              .catch(error => {
                console.error(`[ModelManager] 创建表情失败:`, error);
              });
          } catch (error) {
            console.error(`[ModelManager] 创建表情失败:`, error);
          }
        });
      } else {
        // 使用已加载的表情
        this._expressionManager.startMotion(expression, false);
        console.info(`[ModelManager] 播放表情: ${expressionName}`);
      }
    } catch (error) {
      console.error('[ModelManager] 播放表情失败:', error);
    }
  }

  /**
   * 更新模型
   */
  update(deltaTime: number): void {
    if (this._state !== ModelState.Loaded || !this._model) {
      return;
    }

    // 更新动作管理器
    if (this._motionManager) {
      this._motionManager.updateMotion(this._model, deltaTime);
    }

    // 更新表情管理器
    if (this._expressionManager) {
      this._expressionManager.updateMotion(this._model, deltaTime);
    }

    // 更新模型
    this._model.update();
  }

  /**
   * 渲染模型
   */
  render(): void {
    if (this._state !== ModelState.Loaded || !this._model || !this._renderer || !this._gl) {
      return;
    }

    // 更新投影矩阵
    if (this._projectionMatrix && this._canvas) {
      const width = this._canvas.width;
      const height = this._canvas.height;
      this._projectionMatrix.loadIdentity();
      this._projectionMatrix.scale(height / width, 1.0);
    }

    // 渲染模型
    if (this._projectionMatrix && this._modelMatrix) {
      const viewMatrix = this._projectionMatrix;
      viewMatrix.multiplyByMatrix(this._modelMatrix);
      this._renderer.drawModel(this._model, viewMatrix);
    }
  }

  /**
   * 获取模型
   */
  getModel(): any {
    return this._model;
  }

  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return this._state === ModelState.Loaded;
  }

  /**
   * 释放资源
   */
  release(): void {
    // 释放模型资源
    if (this._model) {
      this._model.release();
      this._model = null;
    }

    if (this._renderer) {
      this._renderer.release();
      this._renderer = null;
    }

    // 释放动作和表情
    this._motions.forEach(motion => {
      if (motion && typeof motion.delete === 'function') {
        motion.delete();
      }
    });
    this._motions.clear();

    this._expressions.forEach(expression => {
      if (expression && typeof expression.delete === 'function') {
        expression.delete();
      }
    });
    this._expressions.clear();

    this._motionManager = null;
    this._expressionManager = null;
    this._modelMatrix = null;
    this._projectionMatrix = null;
    this._state = ModelState.NotLoaded;
  }
}
