/**
 * Cubism SDK 适配器
 * 封装 Cubism Framework 的初始化和模型管理
 */

import { LAppPal } from './LAppPal';

// Cubism Framework 类型声明
declare let Live2DCubismCore: any;

/**
 * Cubism Framework 适配器
 */
export class CubismAdapter {
  private static _isInitialized = false;
  private static _cubismFramework: any = null;

  /**
   * 初始化 Cubism Framework
   */
  static async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // 确保 Cubism Core 已加载
      if (!window.Live2DCubismCore && !window.CubismCore) {
        throw new Error('Cubism Core 未加载');
      }

      // 动态导入 Cubism Framework
      const frameworkModule = await import('@framework/live2dcubismframework');
      const { CubismFramework, Option, LogLevel } = frameworkModule;

      if (!CubismFramework.isStarted()) {
        const option = new Option();
        option.logFunction = LAppPal.printMessage;
        option.loggingLevel = LogLevel.LogLevel_Verbose;
        CubismFramework.startUp(option);
        CubismFramework.initialize();
        console.info('✅ Cubism Framework 初始化成功');
      } else {
        console.info('✅ Cubism Framework 已初始化');
      }

      this._cubismFramework = CubismFramework;
      this._isInitialized = true;
    } catch (error) {
      console.warn('[CubismAdapter] Framework 初始化失败，将使用简化实现:', error);
      // 即使 Framework 初始化失败，也继续使用简化实现
      this._isInitialized = true;
    }
  }

  /**
   * 检查是否已初始化
   */
  static isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * 获取 Cubism Framework 实例
   */
  static getFramework(): any {
    return this._cubismFramework;
  }
}
