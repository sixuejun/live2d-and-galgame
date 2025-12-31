# 双角色系统实现指南

## 已完成部分

1. ✅ 数据结构更新
   - `DualPositionSettings` 接口定义（left/right）
   - `spriteSettings` 和 `live2dSettings` 迁移到新格式
   - `activeCharacters` 列表创建

2. ✅ 活跃角色列表管理
   - `updateActiveCharacters` 函数实现
   - 在消息解析时调用更新函数
   - 支持离场功能

3. ✅ 安全计算属性
   - `safeSpriteSettings` 和 `safeLive2dSettings` 更新为支持 left/right

## 需要完成的步骤

### 步骤1：添加双角色配置计算属性

在 `currentLive2dModelId` 计算属性之后添加：

```typescript
// 双角色系统：左侧角色配置
interface CharacterConfig {
  spriteType: 'live2d' | 'image' | 'none';
  imageUrl?: string;
  live2dModelId?: string;
  motion?: string;
  expression?: string;
}

const leftCharacterConfig = computed<CharacterConfig | null>(() => {
  const leftChar = activeCharacters.value.find(c => c.position === 'left');
  if (!leftChar) return null;
  
  const dialogue = currentDialogue.value;
  
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
  
  // 否则显示该角色的默认状态（无动作/表情）
  const model = live2dModels.value.find(m => m.name === leftChar.name);
  if (model) {
    return {
      spriteType: 'live2d',
      imageUrl: undefined,
      live2dModelId: model.id || model.name,
      motion: undefined,
      expression: undefined,
    };
  }
  
  return {
    spriteType: 'none',
    imageUrl: undefined,
    live2dModelId: undefined,
    motion: undefined,
    expression: undefined,
  };
});

const rightCharacterConfig = computed<CharacterConfig | null>(() => {
  const rightChar = activeCharacters.value.find(c => c.position === 'right');
  if (!rightChar) return null;
  
  const dialogue = currentDialogue.value;
  
  // 如果当前对话是该角色，使用对话中的配置
  if (dialogue?.character === rightChar.name) {
    return {
      spriteType: currentSpriteType.value,
      imageUrl: currentImageUrl.value,
      live2dModelId: currentLive2dModelId.value,
      motion: dialogue.motion,
      expression: dialogue.expression,
    };
  }
  
  // 否则显示该角色的默认状态（无动作/表情）
  const model = live2dModels.value.find(m => m.name === rightChar.name);
  if (model) {
    return {
      spriteType: 'live2d',
      imageUrl: undefined,
      live2dModelId: model.id || model.name,
      motion: undefined,
      expression: undefined,
    };
  }
  
  return {
    spriteType: 'none',
    imageUrl: undefined,
    live2dModelId: undefined,
    motion: undefined,
    expression: undefined,
  };
});
```

### 步骤2：更新模板使用双 CharacterSprite

将模板中的单个 CharacterSprite 替换为两个：

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

### 步骤3：更新 SettingsPanel 支持左右切换

**文件：** `src/live2d与galgame界面前端/components/SettingsPanel.vue`

1. 更新 Props 接口：

```typescript
interface Props {
  onClose: () => void;
  userDisplayName: string;
  onUserDisplayNameChange: (name: string) => void;
  spriteSettings: {
    left: { scale: number; positionX: number; positionY: number };
    right: { scale: number; positionX: number; positionY: number };
  };
  onSpriteSettingsChange: (settings: typeof spriteSettings) => void;
  live2dSettings: {
    left: { scale: number; positionX: number; positionY: number };
    right: { scale: number; positionX: number; positionY: number };
  };
  onLive2dSettingsChange: (settings: typeof live2dSettings) => void;
  // ... 其他 props
}
```

1. 添加左右切换状态：

```typescript
const currentSpriteSide = ref<'left' | 'right'>('left');
const currentLive2dSide = ref<'left' | 'right'>('left');
```

1. 在立绘设置标题右侧添加切换按钮：

```vue
<div class="setting-header">
  <h3>立绘设置</h3>
  <div class="side-toggle">
    <button 
      :class="['toggle-btn', { active: currentSpriteSide === 'left' }]"
      @click="currentSpriteSide = 'left'"
    >
      左
    </button>
    <button 
      :class="['toggle-btn', { active: currentSpriteSide === 'right' }]"
      @click="currentSpriteSide = 'right'"
    >
      右
    </button>
  </div>
</div>
```

1. 更新设置值的读取和更新：

```typescript
const displayedSpriteSettings = computed(() => 
  props.spriteSettings[currentSpriteSide.value]
);

function updateSpriteSettings(settings: { scale: number; positionX: number; positionY: number }) {
  props.onSpriteSettingsChange({
    ...props.spriteSettings,
    [currentSpriteSide.value]: settings
  });
}
```

1. 更新模板中的绑定：

```vue
<input
  type="range"
  :value="displayedSpriteSettings.scale"
  min="0.5"
  max="1.5"
  step="0.05"
  class="w-full"
  @input="e => updateSpriteSettings({
    ...displayedSpriteSettings,
    scale: parseFloat((e.target as HTMLInputElement).value),
  })"
/>
```

### 步骤4：更新 GalgamePlayer 中的 SettingsPanel 调用

```vue
<SettingsPanel
  v-if="showSettings"
  :on-close="() => (showSettings = false)"
  :user-display-name="userDisplayName"
  :on-user-display-name-change="(name: string) => {
    userDisplayName = name;
    saveToStorage(STORAGE_KEYS.USER_DISPLAY_NAME, name);
  }"
  :sprite-settings="spriteSettings"
  :on-sprite-settings-change="s => (spriteSettings = s)"
  :live2d-settings="live2dSettings"
  :on-live2d-settings-change="s => (live2dSettings = s)"
  :auto-play="autoPlay"
  :on-auto-play-change="v => (autoPlay = v)"
  :auto-play-speed="autoPlaySpeed"
  :on-auto-play-speed-change="v => (autoPlaySpeed = v)"
  :dialog-style="previewStyle"
  :on-dialog-style-change="s => (previewStyle = s)"
  :on-save-style="handleSaveStyle"
  :current-applied-style="dialogStyle"
  :custom-mode-enabled="customModeEnabled"
  :on-custom-mode-change="v => (customModeEnabled = v)"
/>
```

## 测试要点

1. 单角色对话 → 应该显示在左侧
2. 双角色对话 → 应该分别显示在左右两侧
3. 角色切换 → 新角色替换最久未发言的角色
4. 角色离场 → 从活跃列表移除
5. 设置界面 → 左右切换正常工作
6. 位置和缩放 → 左右独立调整

## 样式调整

在 SettingsPanel.vue 的 `<style>` 部分添加：

```css
.setting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.side-toggle {
  display: flex;
  gap: 4px;
  background: var(--muted);
  border-radius: 6px;
  padding: 2px;
}

.toggle-btn {
  padding: 4px 12px;
  border-radius: 4px;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12px;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.toggle-btn.active {
  background: var(--background);
  color: var(--foreground);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.toggle-btn:hover:not(.active) {
  color: var(--foreground);
}
```

