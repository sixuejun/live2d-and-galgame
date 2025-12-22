/**
 * Cubism Platform Abstraction Layer
 * 平台抽象层，用于文件读取和时间获取等平台相关功能
 */

export class LAppPal {
  /**
   * 将文件作为字节数据读取
   */
  public static loadFileAsBytes(filePath: string, callback: (arrayBuffer: ArrayBuffer, size: number) => void): void {
    fetch(filePath)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => callback(arrayBuffer, arrayBuffer.byteLength))
      .catch(error => {
        console.error(`Failed to load file: ${filePath}`, error);
        callback(new ArrayBuffer(0), 0);
      });
  }

  /**
   * 获取增量时间（与上一帧的差值）
   * @return 增量时间[秒]
   */
  public static getDeltaTime(): number {
    return this.deltaTime;
  }

  /**
   * 更新时间
   */
  public static updateTime(): void {
    this.currentFrame = Date.now();
    this.deltaTime = (this.currentFrame - this.lastFrame) / 1000;
    this.lastFrame = this.currentFrame;
  }

  /**
   * 输出消息
   */
  public static printMessage(message: string): void {
    console.log(message);
  }

  static lastUpdate = Date.now();
  static currentFrame = 0.0;
  static lastFrame = 0.0;
  static deltaTime = 0.0;
}
