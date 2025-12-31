# 实现进度报告

## 已完成功能

### 1. Cubism 2.1 支持 ✅

#### 版本检测
- ✅ 更新 `GalgamePlayer.vue` 中的 `loadLive2dModels` 函数，支持自动检测模型版本
  - 优先使用 `model3` (版本 3)
  - 其次使用 `model` (版本 2)
  - 最后使用 `moc3` (版本 3) 或 `moc` (版本 2)
  - 支持世界书明确指定版本

#### 开场界面支持
- ✅ 更新 `src/开场界面/types/index.ts`，添加 Cubism 2.1 文件类型支持
  - 添加 `'moc'`, `'model'`, `'physics'` 到 `ModelFile` 类型
  - 更新 `VirtualModelFiles` 接口，添加对应字段
- ✅ 更新 `src/开场界面/composables.ts`
  - `convertToLive2DConfig` 函数支持检测 Cubism 2.1 模型
  - `classifyFiles` 函数支持分类 `.moc`, `.model.json`, `.physics.json` 文件
  - 添加 `parseModelMotions` 函数用于解析 Cubism 2.1 的 `model.json` 文件
- ✅ 更新 `src/开场界面/utils/worldbookFormat.ts`
  - `ModelResourceWorldbookData` 接口添加 `version` 字段
  - `files` 对象添加 `model`, `moc`, `physics` 字段

#### pixi-live2d-display 集成
- ✅ `pixi-live2d-display` 库本身已支持 Cubism 2/3/4
- ✅ `src/live2d与galgame界面前端/index.ts` 已加载所需运行时
  - `live2d.min.js` (Cubism 2.1)
  - `live2dcubismcore.min.js` (Cubism 4)

### 2. model3.json 自动解析与 textMappings 校验 ✅

#### 解析功能增强
- ✅ 更新 `parseModel3Motions` 函数，提取完整的动作信息
  - 包含 `name` (从文件名提取)
  - 保留 `group`, `index`, `file` 等信息
- ✅ 新增 `parseModelMotions` 函数，支持解析 Cubism 2.1 的 `model.json`

#### 校验机制
- ✅ 创建 `src/开场界面/utils/validation.ts` 文件
  - `validateTextMappings` 函数：校验 textMappings 中的关键字
  - 检查动作文件是否存在（支持 URL 和本地文件）
  - 检查 index 和 group 是否有效
  - 检测重复的 textMappings
  - `formatValidationResult` 函数：格式化校验结果为可读文本
  - `limitConcurrency` 函数：限制并发请求数量

### 3. 离场功能支持 ✅

- ✅ 更新 `src/live2d与galgame界面前端/utils/messageParser.ts`
  - 在 `parseMessageBlocks` 函数中添加离场检测逻辑
  - 支持多种离场格式：
    - `[[character||角色名：{{角色名}}||离场]]`
    - `kvPairs['离场']`
    - `kvPairs['exit']`
    - `kvPairs['动作'] === '离场'`
    - `kvPairs['表情'] === '离场'`
- ✅ 更新 `src/live2d与galgame界面前端/types/message.ts`
  - `MessageBlock` 接口添加 `shouldExit?: boolean` 字段

## 进行中功能

### 4. 双角色同时在场系统 🚧

需要在 `GalgamePlayer.vue` 中实现以下功能：

#### 4.1 活跃角色列表管理
```typescript
// 需要添加的状态
const activeCharacters = ref<Array<{
  name: string;
  lastSpokeIndex: number;
  position: 'left' | 'right';
}>>([]);

// 需要实现的函数
function updateActiveCharacters(characterName: string, dialogueIndex: number, shouldExit: boolean) {
  if (shouldExit) {
    // 移除角色
    const index = activeCharacters.value.findIndex(c => c.name === characterName);
    if (index >= 0) {
      activeCharacters.value.splice(index, 1);
    }
    return;
  }

  // 查找是否已存在
  const existingIndex = activeCharacters.value.findIndex(c => c.name === characterName);
  
  if (existingIndex >= 0) {
    // 更新最后发言索引
    activeCharacters.value[existingIndex].lastSpokeIndex = dialogueIndex;
  } else {
    // 添加新角色
    if (activeCharacters.value.length >= 2) {
      // 移除最久未发言的角色
      const oldestIndex = activeCharacters.value.reduce((minIdx, curr, idx, arr) => 
        curr.lastSpokeIndex < arr[minIdx].lastSpokeIndex ? idx : minIdx
      , 0);
      activeCharacters.value.splice(oldestIndex, 1);
    }
    
    // 确定位置
    const position = activeCharacters.value.length === 0 ? 'left' : 'right';
    activeCharacters.value.push({
      name: characterName,
      lastSpokeIndex: dialogueIndex,
      position
    });
  }
}
```

#### 4.2 双 CharacterSprite 组件
需要修改模板，使用两个 CharacterSprite：
```vue
<!-- 左侧角色 -->
<CharacterSprite
  v-if="leftCharacter"
  :sprite-scale="spriteSettings.left.scale"
  :sprite-position-x="spriteSettings.left.positionX"
  :sprite-position-y="spriteSettings.left.positionY"
  :live2d-scale="live2dSettings.left.scale"
  :live2d-position-x="live2dSettings.left.positionX"
  :live2d-position-y="live2dSettings.left.positionY"
  :sprite-type="leftCharacter.spriteType"
  :image-url="leftCharacter.imageUrl"
  :live2d-model-id="leftCharacter.live2dModelId"
  :live2d-models="live2dModels"
  :motion="leftCharacter.motion"
  :expression="leftCharacter.expression"
/>

<!-- 右侧角色 -->
<CharacterSprite
  v-if="rightCharacter"
  :sprite-scale="spriteSettings.right.scale"
  :sprite-position-x="spriteSettings.right.positionX"
  :sprite-position-y="spriteSettings.right.positionY"
  :live2d-scale="live2dSettings.right.scale"
  :live2d-position-x="live2dSettings.right.positionX"
  :live2d-position-y="live2dSettings.right.positionY"
  :sprite-type="rightCharacter.spriteType"
  :image-url="rightCharacter.imageUrl"
  :live2d-model-id="rightCharacter.live2dModelId"
  :live2d-models="live2dModels"
  :motion="rightCharacter.motion"
  :expression="rightCharacter.expression"
/>
```

#### 4.3 角色配置计算
```typescript
const leftCharacter = computed(() => {
  if (activeCharacters.value.length === 0) return null;
  
  const leftChar = activeCharacters.value.find(c => c.position === 'left');
  if (!leftChar) return null;
  
  const dialogue = currentDialogue.value;
  if (!dialogue || dialogue.character !== leftChar.name) {
    // 返回默认状态
    return {
      spriteType: 'none',
      imageUrl: '',
      live2dModelId: leftChar.name,
      motion: '',
      expression: ''
    };
  }
  
  // 返回当前对话的状态
  return {
    spriteType: currentSpriteType.value,
    imageUrl: currentImageUrl.value,
    live2dModelId: leftChar.name,
    motion: dialogue.motion || '',
    expression: dialogue.expression || ''
  };
});

const rightCharacter = computed(() => {
  // 类似 leftCharacter 的逻辑
});
```

#### 4.4 数据结构修改
```typescript
// 修改 spriteSettings 和 live2dSettings 的结构
const spriteSettings = ref({
  left: { scale: 1, positionX: 24, positionY: 100 },
  right: { scale: 1, positionX: 76, positionY: 100 }
});

const live2dSettings = ref({
  left: { scale: 1, positionX: 24, positionY: 50 },
  right: { scale: 1, positionX: 76, positionY: 50 }
});
```

## 待实现功能

### 5. 设置界面左右位置切换 ⏳

需要修改 `SettingsPanel.vue`：

#### 5.1 添加左右切换UI
```vue
<div class="setting-header">
  <h3>立绘设置</h3>
  <div class="position-toggle">
    <button 
      :class="['toggle-btn', { active: currentSide === 'left' }]"
      @click="currentSide = 'left'"
    >
      左
    </button>
    <button 
      :class="['toggle-btn', { active: currentSide === 'right' }]"
      @click="currentSide = 'right'"
    >
      右
    </button>
  </div>
</div>
```

#### 5.2 更新 props 和回调
```typescript
// Props
interface Props {
  spriteSettings: {
    left: { scale: number; positionX: number; positionY: number };
    right: { scale: number; positionX: number; positionY: number };
  };
  live2dSettings: {
    left: { scale: number; positionX: number; positionY: number };
    right: { scale: number; positionX: number; positionY: number };
  };
  // ... 其他 props
}

// 状态
const currentSide = ref<'left' | 'right'>('left');

// 计算当前显示的设置
const displayedSpriteSettings = computed(() => 
  props.spriteSettings[currentSide.value]
);

// 更新回调
function updateSpriteSettings(settings: { scale: number; positionX: number; positionY: number }) {
  props.onSpriteSettingsChange({
    ...props.spriteSettings,
    [currentSide.value]: settings
  });
}
```

### 6. 测试与修复 ⏳

#### 需要测试的功能点
1. [ ] Cubism 2.1 模型加载和动作播放
2. [ ] Cubism 3/4 模型加载和动作播放
3. [ ] 模型版本自动检测
4. [ ] textMappings 校验功能
5. [ ] 双角色位置分配逻辑
6. [ ] 角色离场功能
7. [ ] 设置界面的左右切换
8. [ ] 向后兼容性（单角色模式）

## 技术注意事项

### pixi-live2d-display 使用
- 库已支持 Cubism 2/3/4
- 使用 `Live2DModel.from(modelUrl)` 自动检测版本
- 需要预先加载对应的 Cubism Core 运行时

### 性能优化
- textMappings 文件检查使用并发限制（最多5个）
- 文件检查结果需要缓存
- 双角色渲染时，非活跃角色可降低渲染质量

### 向后兼容
- 保持单角色模式兼容
- 旧的位置配置自动迁移到 left 配置
- textMappings 校验失败不阻止保存，只显示警告

## 下一步行动

1. 完成双角色系统实现
   - 实现 `updateActiveCharacters` 函数
   - 修改模板使用双 CharacterSprite
   - 实现角色配置计算逻辑
   - 修改数据结构

2. 实现设置界面的左右切换
   - 添加切换UI
   - 更新 props 结构
   - 实现切换逻辑

3. 集成 textMappings 校验到 ModelUploadWizard
   - 添加校验按钮
   - 显示校验结果
   - 提供修复建议

4. 全面测试和修复bug


