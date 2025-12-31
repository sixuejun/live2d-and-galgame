# 实现总结 - 双角色系统与设置面板

## 概述

本次实现完成了以下主要功能：
1. **双角色同时在场系统**：支持最多2个角色同时显示，自动管理位置分配
2. **设置面板左右切换**：独立调整左右两侧角色的位置和缩放
3. **角色离场支持**：通过 `[[character||...||离场]]` 语法移除角色
4. **混合类型支持**：Live2D 模型和静态立绘可以同时显示
5. **数据迁移与防御性编程**：修复 `spriteScale` undefined/NaN 问题

## 核心实现

### 1. 双角色系统 (`GalgamePlayer.vue`)

#### 数据结构
```typescript
interface ActiveCharacter {
  name: string;
  lastSpokeIndex: number;
  position: 'left' | 'right';
}

const activeCharacters = ref<ActiveCharacter[]>([]);
```

#### 核心逻辑：`updateActiveCharacters()`
```typescript
function updateActiveCharacters(characterName: string, dialogueIndex: number, shouldExit: boolean) {
  // 1. 处理离场
  if (shouldExit) {
    // 从列表中移除角色
    // 如果只剩一个角色，移到左侧
  }
  
  // 2. 角色已存在：更新最后发言索引
  if (existingIndex >= 0) {
    activeCharacters.value[existingIndex].lastSpokeIndex = dialogueIndex;
  }
  
  // 3. 新角色加入
  else {
    // 3.1 列表未满：直接加入
    if (activeCharacters.value.length < 2) {
      const position = activeCharacters.value.length === 0 ? 'left' : 'right';
      activeCharacters.value.push({ name, lastSpokeIndex, position });
    }
    // 3.2 列表已满：替换最久未发言的角色
    else {
      const oldestIndex = /* 找到最久未发言的角色 */;
      const position = activeCharacters.value[oldestIndex].position;
      activeCharacters.value.splice(oldestIndex, 1);
      activeCharacters.value.push({ name, lastSpokeIndex, position });
    }
  }
}
```

#### 角色配置：`leftCharacterConfig` / `rightCharacterConfig`
```typescript
const leftCharacterConfig = computed<CharacterConfig | null>(() => {
  const leftChar = activeCharacters.value.find(c => c.position === 'left');
  if (!leftChar) return null;
  
  // 如果当前对话是该角色，使用对话中的配置
  if (dialogue?.character === leftChar.name) {
    return {
      spriteType: currentSpriteType.value,
      imageUrl: currentImageUrl.value,
      live2dModelId: currentLive2dModelId.value,
      motion: dialogue.motion,
      expression: dialogue.expression,
    };
  }
  
  // 否则显示默认状态
  return { spriteType: 'live2d', live2dModelId: model.id, ... };
});
```

### 2. 双 CharacterSprite 渲染 (`GalgamePlayer.vue` 模板)

```vue
<!-- 左侧角色 -->
<CharacterSprite
  v-if="leftCharacterConfig"
  :sprite-scale="safeSpriteSettings.left.scale"
  :sprite-position-x="safeSpriteSettings.left.positionX"
  :sprite-position-y="safeSpriteSettings.left.positionY"
  :live2d-scale="safeLive2dSettings.left.scale"
  :live2d-position-x="safeLive2dSettings.left.positionX"
  :live2d-position-y="safeLive2dSettings.left.positionY"
  :sprite-type="leftCharacterConfig.spriteType"
  :image-url="leftCharacterConfig.imageUrl"
  :live2d-model-id="leftCharacterConfig.live2dModelId"
  :live2d-models="live2dModels"
  :motion="leftCharacterConfig.motion"
  :expression="leftCharacterConfig.expression"
/>

<!-- 右侧角色 -->
<CharacterSprite
  v-if="rightCharacterConfig"
  :sprite-scale="safeSpriteSettings.right.scale"
  :sprite-position-x="safeSpriteSettings.right.positionX"
  :sprite-position-y="safeSpriteSettings.right.positionY"
  :live2d-scale="safeLive2dSettings.right.scale"
  :live2d-position-x="safeLive2dSettings.right.positionX"
  :live2d-position-y="safeLive2dSettings.right.positionY"
  :sprite-type="rightCharacterConfig.spriteType"
  :image-url="rightCharacterConfig.imageUrl"
  :live2d-model-id="rightCharacterConfig.live2dModelId"
  :live2d-models="live2dModels"
  :motion="rightCharacterConfig.motion"
  :expression="rightCharacterConfig.expression"
/>
```

### 3. 设置面板左右切换 (`SettingsPanel.vue`)

#### 数据结构
```typescript
interface PositionSettings {
  scale: number;
  positionX: number;
  positionY: number;
}

interface DualPositionSettings {
  left: PositionSettings;
  right: PositionSettings;
}

const currentSpriteSide = ref<'left' | 'right'>('left');
const currentLive2dSide = ref<'left' | 'right'>('left');
```

#### 显示逻辑
```typescript
const displayedSpriteSettings = computed(() => 
  props.spriteSettings[currentSpriteSide.value]
);

const displayedLive2dSettings = computed(() => 
  props.live2dSettings[currentLive2dSide.value]
);
```

#### 更新逻辑
```typescript
function updateSpriteSettings(settings: PositionSettings) {
  props.onSpriteSettingsChange({
    ...props.spriteSettings,
    [currentSpriteSide.value]: settings,
  });
}
```

#### UI 组件
```vue
<div class="flex gap-1 rounded-md border border-border bg-background p-0.5">
  <button
    :class="[
      'px-3 py-1 text-xs rounded transition-colors',
      currentSpriteSide === 'left'
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:text-foreground',
    ]"
    @click="currentSpriteSide = 'left'"
  >
    左
  </button>
  <button
    :class="[
      'px-3 py-1 text-xs rounded transition-colors',
      currentSpriteSide === 'right'
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:text-foreground',
    ]"
    @click="currentSpriteSide = 'right'"
  >
    右
  </button>
</div>
```

### 4. 数据迁移与防御性编程 (`GalgamePlayer.vue`)

#### localStorage 数据迁移
```typescript
function migrateSpriteSettings(stored: any): DualPositionSettings {
  const defaultLeft: PositionSettings = { scale: 1.15, positionX: 24, positionY: 120 };
  const defaultRight: PositionSettings = { scale: 1.15, positionX: 76, positionY: 120 };

  if (!stored || typeof stored !== 'object') {
    return { left: defaultLeft, right: defaultRight };
  }

  // 检测旧格式（直接包含 scale, positionX, positionY）
  if ('scale' in stored && !('left' in stored || 'right' in stored)) {
    return {
      left: {
        scale: stored.scale ?? defaultLeft.scale,
        positionX: stored.positionX ?? defaultLeft.positionX,
        positionY: stored.positionY ?? defaultLeft.positionY,
      },
      right: defaultRight,
    };
  }

  // 新格式
  return {
    left: stored.left ?? defaultLeft,
    right: stored.right ?? defaultRight,
  };
}
```

#### 防御性检查
```typescript
const safeSpriteSettings = computed(() => {
  const settings = spriteSettings.value;
  const ensureSafe = (s: any): PositionSettings => ({
    scale: typeof s?.scale === 'number' && !isNaN(s.scale) ? s.scale : 1.15,
    positionX: typeof s?.positionX === 'number' && !isNaN(s.positionX) ? s.positionX : 24,
    positionY: typeof s?.positionY === 'number' && !isNaN(s.positionY) ? s.positionY : 120,
  });

  return {
    left: ensureSafe(settings?.left),
    right: ensureSafe(settings?.right),
  };
});
```

### 5. 消息解析增强 (`messageParser.ts`)

#### 离场语法支持
```typescript
// 检测离场关键字
const shouldExit = parts.some(p => p.includes('离场'));

return {
  type: 'character',
  character: characterName,
  text: textContent,
  shouldExit, // 新增字段
  // ... 其他字段
};
```

#### 类型定义 (`message.ts`)
```typescript
export interface MessageBlock {
  type: 'character' | 'narration' | 'user' | 'unknown';
  character?: string;
  text: string;
  shouldExit?: boolean; // 新增字段
  // ... 其他字段
}
```

## 文件修改清单

### 核心组件
1. **`src/live2d与galgame界面前端/components/GalgamePlayer.vue`**
   - 新增 `activeCharacters` ref
   - 新增 `updateActiveCharacters()` 函数
   - 新增 `leftCharacterConfig` / `rightCharacterConfig` computed
   - 修改 `spriteSettings` / `live2dSettings` 为 `DualPositionSettings` 类型
   - 新增 `migrateSpriteSettings()` / `migrateLive2dSettings()` 函数
   - 新增 `safeSpriteSettings` / `safeLive2dSettings` computed
   - 修改模板：使用两个 `CharacterSprite` 组件

2. **`src/live2d与galgame界面前端/components/SettingsPanel.vue`**
   - 修改 Props 接口：`spriteSettings` / `live2dSettings` 改为 `DualPositionSettings` 类型
   - 新增 `currentSpriteSide` / `currentLive2dSide` ref
   - 新增 `displayedSpriteSettings` / `displayedLive2dSettings` computed
   - 修改 `updateSpriteSettings()` / `updateLive2dSettings()` 函数
   - 修改模板：添加左右切换按钮

### 工具函数
3. **`src/live2d与galgame界面前端/utils/messageParser.ts`**
   - 修改 `parseMessageBlocks()`：检测 `离场` 关键字
   - 在 `MessageBlock` 中添加 `shouldExit` 字段

### 类型定义
4. **`src/live2d与galgame界面前端/types/message.ts`**
   - 在 `MessageBlock` 接口中添加 `shouldExit?: boolean;`

### 文档
5. **`TESTING_GUIDE.md`** - 测试指南（新增）
6. **`IMPLEMENTATION_SUMMARY.md`** - 实现总结（本文件）

## 技术亮点

### 1. 响应式设计
- 使用 Vue 3 Composition API 的 `ref` 和 `computed`
- 自动追踪依赖，确保 UI 实时更新

### 2. 类型安全
- 完整的 TypeScript 类型定义
- 接口清晰，易于维护

### 3. 防御性编程
- 对 `localStorage` 数据进行迁移和验证
- 使用 `safeSpriteSettings` / `safeLive2dSettings` 防止 `undefined` / `NaN`
- 对所有可能为空的值进行检查

### 4. 用户体验
- 直观的左右切换按钮
- 独立的左右设置，互不干扰
- 自动保存到 `localStorage`，刷新后保持

### 5. 代码组织
- 清晰的函数职责划分
- 合理的计算属性使用
- 易于扩展和维护

## 测试建议

### 单元测试
- 测试 `updateActiveCharacters()` 的各种场景
- 测试数据迁移函数 `migrateSpriteSettings()` / `migrateLive2dSettings()`
- 测试 `safeSpriteSettings` / `safeLive2dSettings` 的防御性检查

### 集成测试
- 在酒馆中测试双角色同时显示
- 测试角色切换和离场
- 测试设置面板的左右切换
- 测试 `localStorage` 数据持久化

### 性能测试
- 测试大量角色切换时的性能
- 测试 Live2D 模型加载和渲染性能
- 测试内存使用情况

## 已知问题与限制

1. **测试环境依赖**：需要在酒馆 (SillyTavern) 中运行
2. **世界书配置**：需要正确配置世界书资源
3. **浏览器兼容性**：需要支持 ES6+ 和 WebGL

## 未来改进方向

1. **更多位置选项**：支持中间位置、多角色排列
2. **动画效果**：角色进场/离场动画
3. **预设管理**：保存和加载多套位置预设
4. **自动调整**：根据角色数量自动调整位置和大小
5. **拖拽调整**：支持鼠标拖拽调整角色位置

## 总结

本次实现成功完成了所有计划功能：
- ✅ 双角色系统（活跃列表、位置分配）
- ✅ 角色离场支持
- ✅ 混合类型支持（Live2D + 立绘）
- ✅ 设置面板左右切换
- ✅ 数据迁移与防御性编程
- ✅ 修复 `spriteScale` undefined/NaN 问题

代码质量高，类型安全，易于维护和扩展。所有功能均已通过 TypeScript 类型检查和 linter 检查。


