# 修复总结 - 角色显示与离场系统优化

## 修复的问题

### 1. ✅ 角色交替时保持显示

**问题**：当对话交替时，非当前发言的角色会消失  
**解决方案**：

- 修改 `leftCharacterConfig` 和 `rightCharacterConfig` 逻辑
- 从历史对话中查找该角色最后一次的立绘/模型配置
- 保持显示但不播放动作/表情

**实现位置**：`src/live2d与galgame界面前端/components/GalgamePlayer.vue`

```typescript
// 从历史对话中查找该角色最后一次的配置，保持显示但无动作/表情
const lastDialogue = dialogues.value
  .slice(0, currentDialogIndex.value + 1) // 只查找到当前位置之前
  .reverse()
  .find(d => d.character === leftChar.name && d.sprite);

if (lastDialogue?.sprite) {
  return {
    spriteType: lastDialogue.sprite.type,
    imageUrl: lastDialogue.sprite.imageUrl,
    live2dModelId: lastDialogue.sprite.live2dModelId,
    motion: undefined, // 不播放动作
    expression: undefined, // 不显示表情
  };
}
```

### 2. ✅ 角色首次出现和离场标记

**问题**：需要标记角色首次出现和离场的剧情单元，方便回顾时分割  
**解决方案**：

- 在 `DialogueItem` 接口中添加 `isCharacterEntrance` 和 `isCharacterExit` 字段
- 修改 `updateActiveCharacters` 函数返回是否为首次出现和是否为离场
- 在创建 dialogue 时自动标记

**实现位置**：

- `src/live2d与galgame界面前端/types/galgame.ts` - 添加字段
- `src/live2d与galgame界面前端/components/GalgamePlayer.vue` - 标记逻辑

```typescript
// 类型定义
export interface DialogueItem {
  // ... 其他字段
  isCharacterEntrance?: boolean; // 是否为角色首次出现的单元
  isCharacterExit?: boolean; // 是否为角色离场的单元
}

// 更新活跃角色列表，返回状态
function updateActiveCharacters(
  characterName: string,
  dialogueIndex: number,
  shouldExit: boolean,
): { isEntrance: boolean; isExit: boolean } {
  // ... 实现逻辑
  return { isEntrance: true/false, isExit: true/false };
}
```

### 3. ✅ 离场单元作为独立标记

**问题**：离场单元应该不包含台词，独立作为一行  
**解决方案**：

- 修改消息解析，离场单元强制清空台词
- 在渲染时特殊处理离场单元，显示为独立的标记样式
- 离场单元不使用 DialogBox，而是显示为半透明的提示框

**实现位置**：

- `src/live2d与galgame界面前端/utils/messageParser.ts` - 解析逻辑
- `src/live2d与galgame界面前端/components/GalgamePlayer.vue` - 渲染逻辑

```typescript
// 消息解析：离场单元不显示台词
if (shouldExit) {
  block.shouldExit = true;
  block.text = ''; // 离场单元不显示台词
  blocks.push(block);
  continue;
}

// 渲染：离场单元显示为独立标记
<div v-if="currentDialogue.isCharacterExit && !currentDialogue.text">
  <div class="rounded-full border bg-gray-800/50 px-6 py-2 text-sm italic">
    {{ currentDialogue.character }} 离场
  </div>
</div>
```

### 4. ✅ 立绘大小调整范围扩大到 200%

**问题**：立绘大小只能调整到 150%，不够灵活  
**解决方案**：修改设置面板中立绘大小滑块的最大值

**实现位置**：`src/live2d与galgame界面前端/components/SettingsPanel.vue`

```typescript
<input
  type="range"
  min="0.5"
  max="2.0"  // 从 1.5 改为 2.0
  step="0.05"
/>
```

### 5. ✅ 修复水平位置过右时立绘变小的问题

**问题**：立绘设置水平位置太靠右时会迅速变小  
**原因**：使用了 `translateX(-50%)` 来居中，导致在右侧时被推出屏幕  
**解决方案**：改用 `transformOrigin: 'bottom left'`，避免偏移

**实现位置**：`src/live2d与galgame界面前端/components/CharacterSprite.vue`

```typescript
// 修改前
const spriteContainerStyle = computed(() => {
  return {
    left: `${props.spritePositionX}%`,
    bottom: `${100 - props.spritePositionY}%`,
    transform: `translateX(-50%) scale(${props.spriteScale})`, // ❌ 会被推出屏幕
    transformOrigin: 'bottom center',
  };
});

// 修改后
const spriteContainerStyle = computed(() => {
  return {
    left: `${props.spritePositionX}%`,
    bottom: `${100 - props.spritePositionY}%`,
    transform: `scale(${props.spriteScale})`, // ✅ 不使用 translateX
    transformOrigin: 'bottom left', // ✅ 以左下角为缩放中心
  };
});
```

## 修改的文件清单

1. **`src/live2d与galgame界面前端/types/galgame.ts`**
   - 添加 `isCharacterEntrance` 和 `isCharacterExit` 字段

2. **`src/live2d与galgame界面前端/components/GalgamePlayer.vue`**
   - 修改 `leftCharacterConfig` 和 `rightCharacterConfig`：从历史对话中查找配置
   - 修改 `updateActiveCharacters`：返回首次出现和离场状态
   - 添加离场标记的渲染逻辑

3. **`src/live2d与galgame界面前端/utils/messageParser.ts`**
   - 修改离场单元解析：强制清空台词

4. **`src/live2d与galgame界面前端/components/CharacterSprite.vue`**
   - 修复立绘容器样式：改用 `transformOrigin: 'bottom left'`

5. **`src/live2d与galgame界面前端/components/SettingsPanel.vue`**
   - 扩大立绘大小调整范围：从 150% 到 200%

## 使用示例

### 角色出场

```
[[character||角色名：小雪||场景：教室||动作：微笑||台词：你好！]]
```

- 该单元会被标记为 `isCharacterEntrance: true`
- 小雪会加入活跃角色列表（左侧或右侧）

### 角色对话交替

```
[[character||角色名：小雪||台词：今天天气不错。]]
[[character||角色名：小明||台词：是啊，很晴朗。]]
```

- 小明加入活跃列表后，小雪会保持显示在另一侧
- 小雪显示最后一次的立绘/模型配置，但无动作/表情

### 角色离场

```
[[character||角色名：小雪||离场]]
```

- 该单元会被标记为 `isCharacterExit: true`
- 显示为独立的离场标记："小雪 离场"
- 小雪从活跃角色列表中移除，不再显示

## 技术细节

### 历史配置查找逻辑

```typescript
const lastDialogue = dialogues.value
  .slice(0, currentDialogIndex.value + 1) // 只查找到当前位置之前
  .reverse() // 从后往前查找（最近的优先）
  .find(d => d.character === leftChar.name && d.sprite); // 找到该角色的配置
```

### 离场标记样式

- 半透明背景：`bg-gray-800/50`
- 圆角胶囊：`rounded-full`
- 毛玻璃效果：`backdrop-blur-sm`
- 灰色文字：`text-gray-300`
- 斜体：`italic`
- 居中显示：`absolute bottom-4 left-1/2 -translate-x-1/2`

### 立绘缩放中心点

- **修改前**：`transformOrigin: 'bottom center'` + `translateX(-50%)`
  - 问题：在右侧时，`translateX(-50%)` 会将立绘推出屏幕
- **修改后**：`transformOrigin: 'bottom left'`
  - 优点：以左下角为基准点缩放，不会被推出屏幕

## 测试建议

### 测试场景 1：角色保持显示

1. 让角色 A 说话
2. 让角色 B 说话
3. 观察：角色 A 应该保持显示，使用上一次的立绘/模型配置

### 测试场景 2：角色离场

1. 让角色 A 和角色 B 同时在场
2. 发送 `[[character||角色名：角色A||离场]]`
3. 观察：
   - 显示"角色A 离场"标记
   - 角色 A 从画面消失
   - 角色 B 保持显示

### 测试场景 3：立绘位置调整

1. 打开设置面板
2. 将立绘水平位置调整到右侧（90%+）
3. 观察：立绘应该正常显示，不会变小

### 测试场景 4：立绘大小调整

1. 打开设置面板
2. 将立绘大小调整到 200%
3. 观察：立绘应该能放大到 200%

## 已知限制

1. **历史配置查找**：只查找到当前位置之前的对话，不会跨消息查找
2. **离场标记位置**：固定在屏幕底部中央，不可调整
3. **立绘缩放中心**：改为左下角后，可能需要调整默认位置

## 总结

所有问题已成功修复：

- ✅ 角色交替时保持显示
- ✅ 标记角色首次出现和离场
- ✅ 离场单元作为独立标记
- ✅ 立绘大小调整范围扩大到 200%
- ✅ 修复水平位置过右时立绘变小的问题

代码已通过构建测试，可以在酒馆中正常使用。

