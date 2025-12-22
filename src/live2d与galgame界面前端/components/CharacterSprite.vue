<template>
  <div
    v-if="spriteType !== 'none'"
    ref="spriteContainerRef"
    class="pointer-events-none absolute z-5 transition-all duration-300"
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Live2DRenderer, type Live2DModelConfig } from '../lib/renderers/Live2DRenderer';

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
// 记录上一次的动作和表情，用于判断是否需要重新播放
let lastMotion: string | undefined = undefined;
let lastExpression: string | undefined = undefined;
let lastModelId: string | undefined = undefined;

// 容器样式
const containerStyle = computed(() => {
  return {
    left: `${props.positionX}%`,
    bottom: `${100 - props.positionY}%`,
    transform: `translateX(-50%) scale(${props.scale})`,
    transformOrigin: 'bottom center',
  };
});

// 播放动作和表情（不重新加载模型）
function playMotionAndExpression(modelConfig: Live2DModelConfig) {
  if (!live2dRenderer) {
    return;
  }

  // 播放动作
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

  // 播放表情
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
}

// 加载 Live2D 模型
async function loadLive2dModel() {
  console.info('[CharacterSprite] loadLive2dModel 被调用', {
    spriteType: props.spriteType,
    live2dModelId: props.live2dModelId,
    hasModels: !!props.live2dModels,
    modelsLength: props.live2dModels?.length || 0,
    hasCanvas: !!live2dCanvasRef.value,
  });

  if (props.spriteType !== 'live2d' || !props.live2dModelId || !props.live2dModels || !live2dCanvasRef.value) {
    console.warn('[CharacterSprite] 加载条件不满足，跳过加载', {
      spriteType: props.spriteType,
      live2dModelId: props.live2dModelId,
      hasModels: !!props.live2dModels,
      hasCanvas: !!live2dCanvasRef.value,
    });
    return;
  }

  // 输出所有可用的模型ID，用于调试
  const availableModels = props.live2dModels.map(m => ({ id: m.id, name: m.name }));
  console.info('[CharacterSprite] 可用的模型列表:', availableModels);
  console.info('[CharacterSprite] 请求的模型ID:', props.live2dModelId, '类型:', typeof props.live2dModelId);

  // 查找模型配置（支持通过 id 或 name 匹配）
  let modelConfig = props.live2dModels.find(m => m.id === props.live2dModelId) as Live2DModelConfig | undefined;

  // 如果通过 id 没找到，尝试通过 name 匹配
  if (!modelConfig) {
    modelConfig = props.live2dModels.find(m => m.name === props.live2dModelId) as Live2DModelConfig | undefined;
    if (modelConfig) {
      console.info(`[CharacterSprite] 通过 name 匹配到模型: ${props.live2dModelId} -> ${modelConfig.id}`);
    }
  }

  if (!modelConfig) {
    console.warn(`[CharacterSprite] 未找到 Live2D 模型配置: ${props.live2dModelId}`, {
      requestedId: props.live2dModelId,
      requestedIdType: typeof props.live2dModelId,
      availableIds: props.live2dModels.map(m => ({ id: m.id, idType: typeof m.id, name: m.name })),
      availableIdsString: JSON.stringify(props.live2dModels.map(m => m.id)),
      requestedIdString: JSON.stringify(props.live2dModelId),
    });
    return;
  }

  console.info('[CharacterSprite] 找到模型配置:', {
    id: modelConfig.id,
    name: modelConfig.name,
    modelPath: modelConfig.modelPath,
    basePath: modelConfig.basePath,
    motionsCount: modelConfig.motions?.length || 0,
    expressionsCount: modelConfig.expressions?.length || 0,
  });

  try {
    // 如果模型ID变化了，需要重新加载模型
    const needReloadModel = lastModelId !== props.live2dModelId;

    if (needReloadModel) {
      // 销毁旧渲染器
      if (live2dRenderer) {
        live2dRenderer.destroy();
        live2dRenderer = null;
      }

      // 创建新渲染器并初始化
      console.info('[CharacterSprite] 开始初始化 Live2D 渲染器');
      live2dRenderer = new Live2DRenderer();
      await live2dRenderer.init(live2dCanvasRef.value);
      console.info('[CharacterSprite] Live2D 渲染器初始化完成，开始加载模型');
      await live2dRenderer.loadModel(modelConfig);
      console.info('[CharacterSprite] Live2D 模型加载完成');
      lastModelId = props.live2dModelId;
    }

    // 检查动作和表情是否变化
    const motionChanged = lastMotion !== props.motion;
    const expressionChanged = lastExpression !== props.expression;

    // 只有当动作或表情变化时，才播放动作和表情
    if (motionChanged || expressionChanged || needReloadModel) {
      playMotionAndExpression(modelConfig);
      lastMotion = props.motion;
      lastExpression = props.expression;
    }
  } catch (error) {
    console.error('[CharacterSprite] 加载 Live2D 模型失败:', error);
    console.error('[CharacterSprite] 错误详情:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      modelId: props.live2dModelId,
      modelConfig: modelConfig ? { id: modelConfig.id, name: modelConfig.name } : null,
    });
  }
}

// 监听模型相关属性变化（模型ID、spriteType等）
watch(
  () => [props.spriteType, props.live2dModelId, props.live2dModels],
  async (newVal, oldVal) => {
    if (props.spriteType === 'live2d') {
      // 检查模型ID是否变化，或者从非live2d切换到live2d
      const oldSpriteType = oldVal?.[0] as typeof props.spriteType | undefined;
      const oldModelId = oldVal?.[1] as string | undefined;
      const modelIdChanged = oldModelId !== props.live2dModelId;
      const spriteTypeChanged = oldSpriteType !== 'live2d';

      // 只有在模型ID变化或从非live2d切换到live2d时，才重置记录
      if (modelIdChanged || spriteTypeChanged) {
        lastMotion = undefined;
        lastExpression = undefined;
      }

      // 等待 DOM 更新，确保 canvas 元素已经渲染
      await nextTick();
      loadLive2dModel();
    } else {
      // 如果不是 Live2D 模式，销毁渲染器
      if (live2dRenderer) {
        live2dRenderer.destroy();
        live2dRenderer = null;
      }
      lastMotion = undefined;
      lastExpression = undefined;
      lastModelId = undefined;
    }
  },
  { immediate: true },
);

// 单独监听动作和表情变化（不重新加载模型）
watch(
  () => [props.motion, props.expression],
  () => {
    if (props.spriteType === 'live2d' && live2dRenderer && props.live2dModelId && props.live2dModels) {
      // 检查动作和表情是否变化
      const motionChanged = lastMotion !== props.motion;
      const expressionChanged = lastExpression !== props.expression;

      // 只有当动作或表情变化时，才播放动作和表情
      if (motionChanged || expressionChanged) {
        const modelConfig = props.live2dModels.find(m => m.id === props.live2dModelId) as Live2DModelConfig | undefined;
        if (modelConfig) {
          playMotionAndExpression(modelConfig);
          lastMotion = props.motion;
          lastExpression = props.expression;
        }
      }
    }
  },
);

onMounted(async () => {
  if (props.spriteType === 'live2d') {
    // 等待 DOM 完全渲染
    await nextTick();
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
