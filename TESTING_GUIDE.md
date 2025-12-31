# 测试指南 - 双角色系统与设置面板

## 已实现的功能

### 1. 双角色系统 ✅

#### 活跃角色列表管理


- **最多2个角色同时在场**：系统维护一个活跃角色列表，最多保留2个角色
- **自动位置分配**：
  - 第一个角色默认在左侧 (`left`)
  - 第二个角色默认在右侧 (`right`)
  - 当列表已满时，新角色会替换最久未发言的角色，并继承其位置


#### 角色更新逻辑

- **角色已存在**：更新该角色的最后发言索引，保持其位置
- **新角色加入**：
  - 如果列表未满，新角色加入并分配空闲位置
  - 如果列表已满，移除最久未发言的角色，新角色继承其位置


#### 角色离场

- **语法**：`[[character||角色名：{{角色名}}||离场]]`
- **行为**：从活跃列表中移除该角色

- **特殊处理**：如果只剩一个角色，将其移到左侧

#### 实现位置

- `src/live2d与galgame界面前端/components/GalgamePlayer.vue`
  - `activeCharacters` ref：存储活跃角色列表
  - `updateActiveCharacters()` 函数：更新活跃角色列表
  - `leftCharacterConfig` / `rightCharacterConfig` computed：为左右两侧提供角色配置


### 2. 双 CharacterSprite 渲染 ✅

#### 独立渲染


- **左侧角色**：使用 `leftCharacterConfig` 提供配置
- **右侧角色**：使用 `rightCharacterConfig` 提供配置
- **条件渲染**：只有当 `leftCharacterConfig` 或 `rightCharacterConfig` 不为 null 时才渲染

#### 混合类型支持


- **Live2D 模型**：`spriteType: 'live2d'`
- **静态立绘**：`spriteType: 'image'`
- **无显示**：`spriteType: 'none'`

#### 独立配置


- 每个 `CharacterSprite` 使用独立的位置和缩放设置
- 左侧使用 `safeSpriteSettings.left` 和 `safeLive2dSettings.left`
- 右侧使用 `safeSpriteSettings.right` 和 `safeLive2dSettings.right`

### 3. 设置面板左右切换 ✅

#### 立绘设置


- **位置**：标题右侧添加"左|右"切换按钮
- **功能**：
  - 点击"左"按钮：调整左侧立绘的缩放和位置
  - 点击"右"按钮：调整右侧立绘的缩放和位置
- **独立存储**：左右两侧的设置独立保存到 `localStorage`


#### Live2D 模型设置

- **位置**：标题右侧添加"左|右"切换按钮
- **功能**：
  - 点击"左"按钮：调整左侧 Live2D 模型的缩放和位置
  - 点击"右"按钮：调整右侧 Live2D 模型的缩放和位置
- **独立存储**：左右两侧的设置独立保存到 `localStorage`

#### 实现位置


- `src/live2d与galgame界面前端/components/SettingsPanel.vue`
  - `currentSpriteSide` ref：当前选中的立绘设置侧（左/右）
  - `currentLive2dSide` ref：当前选中的 Live2D 设置侧（左/右）
  - `displayedSpriteSettings` computed：根据当前选中侧显示对应设置
  - `displayedLive2dSettings` computed：根据当前选中侧显示对应设置

### 4. 数据迁移与防御性编程 ✅


#### localStorage 数据迁移

- **旧格式**：`{ scale, positionX, positionY }`
- **新格式**：`{ left: {...}, right: {...} }`
- **迁移逻辑**：
  - 如果检测到旧格式，将其作为左侧设置
  - 右侧使用默认值

  - 自动保存为新格式

#### 防御性检查

- **`safeSpriteSettings` computed**：
  - 检查 `scale`、`positionX`、`positionY` 是否为有效数字
  - 如果无效，使用默认值（`scale: 1.15, positionX: 24, positionY: 120`）
- **`safeLive2dSettings` computed**：
  - 同样的防御性检查逻辑

  - 确保永远不会传递 `undefined` 或 `NaN` 给 `CharacterSprite`

#### 实现位置

- `src/live2d与galgame界面前端/components/GalgamePlayer.vue`
  - `migrateSpriteSettings()` 函数
  - `migrateLive2dSettings()` 函数

  - `safeSpriteSettings` computed
  - `safeLive2dSettings` computed

### 5. 消息解析增强 ✅

#### 离场语法支持


- **语法**：`[[character||角色名：{{角色名}}||离场]]`
- **解析结果**：`MessageBlock` 中 `shouldExit: true`
- **实现位置**：`src/live2d与galgame界面前端/utils/messageParser.ts`

## 测试步骤


### 前提条件

1. 在酒馆 (SillyTavern) 中安装酒馆助手插件
2. 创建名为 `开场界面-模型数据` 的世界书
3. 在世界书中添加 Live2D 模型资源配置

### 测试场景 1：双角色同时在场


#### 步骤

1. 在酒馆中发送消息：`[[character||角色名：角色A]]你好`

2. 观察：角色A 应该出现在左侧
3. 发送消息：`[[character||角色名：角色B]]你好`
4. 观察：角色B 应该出现在右侧，角色A 仍在左侧

#### 预期结果

- 两个角色同时显示

- 角色A 在左侧，角色B 在右侧
- 控制台输出：`[活跃角色] 新角色 "角色B" 加入，当前活跃角色: ["角色A", "角色B"]`

### 测试场景 2：角色切换（列表已满）


#### 步骤

1. 继续上一场景，发送消息：`[[character||角色名：角色C]]你好`
2. 观察：角色C 应该替换角色A（最久未发言），出现在左侧


#### 预期结果

- 角色C 在左侧，角色B 在右侧
- 角色A 消失
- 控制台输出：`[活跃角色] 列表已满，移除最久未发言的角色: "角色A"`

### 测试场景 3：角色离场

#### 步骤


1. 发送消息：`[[character||角色名：角色B||离场]]再见`
2. 观察：角色B 应该消失，只剩角色C

#### 预期结果

- 只显示角色C（在左侧）

- 控制台输出：`[活跃角色] 角色 "角色B" 离场，当前活跃角色: ["角色C"]`

### 测试场景 4：设置面板左右切换

#### 步骤


1. 点击设置按钮（齿轮图标）打开设置面板
2. 在"立绘设置"部分，点击"左"按钮
3. 调整"大小"滑块
4. 观察：左侧角色的立绘大小应该改变
5. 点击"右"按钮
6. 调整"大小"滑块
7. 观察：右侧角色的立绘大小应该改变，左侧不变

#### 预期结果

- 左右两侧的设置独立
- 调整一侧不影响另一侧

- 设置保存到 `localStorage`，刷新后保持

### 测试场景 5：混合类型（Live2D + 立绘）

#### 步骤


1. 配置角色A 使用 Live2D 模型
2. 配置角色B 使用静态立绘
3. 发送消息让两个角色同时在场
4. 观察：角色A 显示 Live2D 动画，角色B 显示静态图片

#### 预期结果


- 两种类型可以同时显示
- 各自使用独立的位置和缩放设置

## 已知限制

1. **测试环境**：需要在酒馆 (SillyTavern) 中运行，无法独立测试

2. **世界书依赖**：需要正确配置世界书资源
3. **浏览器兼容性**：需要支持 ES6+ 和 WebGL 的现代浏览器

## 调试技巧


### 控制台日志

- `[活跃角色]`：角色列表更新相关日志
- `[GalgamePlayer]`：组件初始化和数据加载日志
- `[Live2D]`：Live2D 模型加载和渲染日志


### localStorage 检查

```javascript
// 在浏览器控制台中运行
console.log('立绘设置:', localStorage.getItem('galgame-sprite-settings'));
console.log('Live2D设置:', localStorage.getItem('galgame-live2d-settings'));
```

### Vue DevTools

- 安装 Vue DevTools 浏览器扩展
- 查看 `activeCharacters` ref 的实时状态
- 查看 `leftCharacterConfig` 和 `rightCharacterConfig` computed 的值


## 故障排除

### 问题：角色不显示

- **检查**：世界书中是否有该角色的模型配置
- **检查**：控制台是否有错误日志
- **检查**：`activeCharacters` 是否包含该角色

### 问题：设置不生效
- **检查**：`localStorage` 中的数据是否正确
- **检查**：是否选择了正确的左/右侧
- **检查**：刷新页面后是否保持

### 问题：角色位置错误

- **检查**：`activeCharacters` 中的 `position` 字段
- **检查**：`leftCharacterConfig` 和 `rightCharacterConfig` 的值
- **检查**：是否有多个角色同名

## 相关文件

- `src/live2d与galgame界面前端/components/GalgamePlayer.vue` - 主组件
- `src/live2d与galgame界面前端/components/SettingsPanel.vue` - 设置面板
- `src/live2d与galgame界面前端/components/CharacterSprite.vue` - 角色渲染组件
- `src/live2d与galgame界面前端/utils/messageParser.ts` - 消息解析
- `src/live2d与galgame界面前端/types/message.ts` - 消息类型定义

## 总结

所有计划中的功能已成功实现：

- ✅ 双角色系统（活跃列表、位置分配）
- ✅ 角色离场支持
- ✅ 混合类型支持（Live2D + 立绘）
- ✅ 设置面板左右切换
- ✅ 数据迁移与防御性编程
- ✅ 修复 `spriteScale` undefined/NaN 问题

代码已通过 TypeScript 类型检查和 linter 检查（仅有不影响功能的警告）。

