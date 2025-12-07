<template>
  <div
    v-if="spriteType !== 'none'"
    ref="spriteContainerRef"
    class="absolute z-5 transition-all duration-300 pointer-events-none"
    :style="containerStyle"
  >
    <!-- 静态图片立绘 -->
    <img
      v-if="spriteType === 'image'"
      :src="imageUrl"
      alt="角色立绘"
      class="h-[70vh] w-auto object-contain drop-shadow-2xl"
      draggable="false"
    />

    <!-- Live2D 模型渲染 -->
    <canvas v-if="spriteType === 'live2d'" ref="live2dCanvasRef" class="live2d-canvas" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Live2DRenderer, type Live2DModelConfig } from '../Live2DRenderer';

interface Props {
  scale: number;
  positionX: number;
  positionY: number;
  spriteType: 'live2d' | 'image' | 'none';
  imageUrl?: string;
  live2dModelId?: string;
  live2dModels?: any[];
  motion?: string;
  expression?: string;
}

const props = defineProps<Props>();

const spriteContainerRef = ref<HTMLDivElement | null>(null);
const live2dCanvasRef = ref<HTMLCanvasElement | null>(null);

let live2dRenderer: Live2DRenderer | null = null;

// 容器样式
const containerStyle = computed(() => {
  return {
    left: `${props.positionX}%`,
    bottom: `${100 - props.positionY}%`,
    transform: `translateX(-50%) scale(${props.scale})`,
    transformOrigin: 'bottom center',
  };
});

// 加载 Live2D 模型
async function loadLive2dModel() {
  if (props.spriteType !== 'live2d' || !props.live2dModelId || !props.live2dModels || !live2dCanvasRef.value) {
    return;
  }

  // 查找模型配置
  const modelConfig = props.live2dModels.find(m => m.id === props.live2dModelId) as Live2DModelConfig | undefined;
  if (!modelConfig) {
    console.warn(`未找到 Live2D 模型配置: ${props.live2dModelId}`);
    return;
  }

  try {
    // 销毁旧渲染器
    if (live2dRenderer) {
      live2dRenderer.destroy();
      live2dRenderer = null;
    }

    // 创建新渲染器并初始化
    live2dRenderer = new Live2DRenderer();
    await live2dRenderer.init(live2dCanvasRef.value);
    await live2dRenderer.loadModel(modelConfig);

    // 播放动作和表情
    // 注意：如果模型配置中有 defaultAnimation，Live2DRenderer 已经会自动处理
    // 只有当明确指定了动作时，才会播放指定动作（会打断默认动作循环）
    if (props.motion) {
      // 查找动作组和索引
      const motionConfig = modelConfig.motions?.find((m: any) => {
        const name = typeof m === 'string' ? m : m.name || m.file;
        return name === props.motion || name === `${props.motion}.motion3.json`;
      });

      if (motionConfig) {
        const group = typeof motionConfig === 'string' ? 'idle' : motionConfig.group || 'idle';
        const normalizedGroup = group === 'default' ? 'idle' : group; // 支持'default'组
        // 查找该动作在组中的索引（支持'default'和'idle'组）
        const groupMotions =
          modelConfig.motions?.filter((m: any) => {
            const mGroup = typeof m === 'string' ? 'idle' : m.group || 'idle';
            const normalizedMGroup = mGroup === 'default' ? 'idle' : mGroup;
            return normalizedMGroup === normalizedGroup || mGroup === group;
          }) || [];
        const index = groupMotions.findIndex((m: any) => {
          const name = typeof m === 'string' ? m : m.name || m.file;
          return name === props.motion || name === `${props.motion}.motion3.json`;
        });
        if (index >= 0) {
          live2dRenderer.playMotion(normalizedGroup, index);
        }
      }
    }
    // 如果没有指定动作且模型有默认动作循环，Live2DRenderer 会自动循环播放

    if (props.expression) {
      // 查找表情索引
      const expressionIndex = modelConfig.expressions?.findIndex((e: any) => {
        const name = typeof e === 'string' ? e : e.name || e.file;
        return name === props.expression || name === `${props.expression}.exp3.json`;
      });

      if (expressionIndex !== undefined && expressionIndex >= 0) {
        live2dRenderer.playExpression(expressionIndex);
      }
    }
    // 如果没有指定表情但模型配置中有默认表情，Live2DRenderer 已经会自动应用
  } catch (error) {
    console.error('加载 Live2D 模型失败:', error);
  }
}

// 监听相关属性变化
watch(
  () => [props.spriteType, props.live2dModelId, props.live2dModels, props.motion, props.expression],
  () => {
    if (props.spriteType === 'live2d') {
      loadLive2dModel();
    } else {
      // 如果不是 Live2D 模式，销毁渲染器
      if (live2dRenderer) {
        live2dRenderer.destroy();
        live2dRenderer = null;
      }
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (props.spriteType === 'live2d') {
    loadLive2dModel();
  }
});

onUnmounted(() => {
  if (live2dRenderer) {
    live2dRenderer.destroy();
    live2dRenderer = null;
  }
});
</script>

<style scoped>
.live2d-canvas {
  width: 100%;
  height: 70vh;
  min-height: 400px;
  display: block;
}
</style>
