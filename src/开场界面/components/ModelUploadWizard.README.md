# 模型上传向导功能说明

## 功能概述

模型上传向导是一个分步式文件上传工具，支持上传 Live2D 模型、角色立绘、背景和 CG 等资源，并自动创建世界书条目供其他界面（如 live2d与galgame界面前端）使用。

## 核心功能特性

### 1. 双模式文件导入

支持两种文件导入方式，可混合使用：

#### 本地文件上传

- **支持方式**：点击上传区域或拖拽文件
- **支持格式**：
  - 模型文件：`.moc3`, `.model3.json`, `.cdi3.json`
  - 图片文件：`.png`, `.jpg`, `.jpeg`
  - 动作/表情文件：`.motion3.json`, `.physics3.json`
- **特点**：文件会被下载并保存到 IndexedDB，使用 `indexeddb://` 路径格式引用

#### URL 导入

- **支持方式**：
  - 单个 URL：直接输入文件 URL
  - 多个 URL：每行一个，或使用逗号/分号分隔
  - GitHub 仓库：自动解析仓库结构并下载所有相关文件
- **GitHub 支持**：
  - `github.com/username/repo` - 自动转换为 GitHub Pages URL
  - `raw.githubusercontent.com` - 自动转换为 GitHub Pages URL
  - `username.github.io/repo` - 直接使用
- **特点**：
  - **重要**：如果文件是通过 URL 导入的，且有正常的可访问 URL，则**直接使用原始 URL 填入世界书，不保存到 IndexedDB**
  - 仅在 URL 不可访问或需要本地存储时才下载到 IndexedDB

### 2. 五步上传流程

#### 步骤 1：上传文件

- **功能**：
  - 支持多次上传，文件会累积到统一列表
  - 可以混合使用本地文件上传和 URL 导入
  - 显示已选择文件的数量和类型
  - 支持移除单个文件或清空全部文件
- **文件预览**：
  - 显示文件名和类型标签（MOC、模型配置、图片等）
  - 每个文件可单独移除
  - 自动检测重复文件并跳过

#### 步骤 2：分类文件

- **资源名称设置**：
  - 输入资源名称（模型名、角色名等）
  - 用于世界书条目名称和文件组织
  - 可自动从模型文件名提取
- **自动分类**：
  - 模型文件（`.moc3`, `.model3.json`, `.cdi3.json`）自动识别
  - 动作/表情文件（`.motion3.json`）智能识别：
    - 根据文件名模式判断（`_E.`、`_M.`、`expression`、`motion` 等）
    - 允许手动切换动作/表情类型
- **手动分类**：
  - 所有图片文件初始归类为"待分类图片"
  - 通过下拉选择框分类为：立绘、背景、CG、纹理
  - 立绘可指定角色名，支持从文件名自动提取
- **分类显示**：
  - 按类别分组显示（模型文件、纹理、动作、立绘、背景、CG、其他）
  - 显示每个分类的文件数量
  - 支持重新分类已分类的图片

#### 步骤 3：模型设置（可选）

- **显示条件**：仅在检测到模型文件时显示
- **设置项**：
  - 模型名称（可编辑）
  - 模型版本（Version 2 或 Version 3）
- **跳过逻辑**：如果没有模型文件，此步骤会自动跳过

#### 步骤 4：资源设置

- **折叠界面设计**：使用可折叠区域分别设置各种资源，界面更清晰
- **动画和表情设置**（有模型时显示）：
  - 默认表情：选择默认显示的表情
  - 默认动作（Idle）：选择默认播放的动作
  - 自动循环默认动作：勾选后会在没有特定文本时自动循环播放
  - 文本映射：
    - 为每个动作/表情设置触发文本
    - 支持多个触发文本，用分号（`;`）分隔
    - 文本以标签形式显示，可单独删除
    - 可选择对应的表情和动作
- **角色立绘设置**（有立绘时显示）：
  - 为每个立绘文件设置文本映射
  - 显示角色名标识
  - 支持为同一角色添加多个立绘文件
- **背景设置**（有背景时显示）：
  - 为每个背景文件设置文本映射
  - 支持多个背景图片
- **CG 设置**（有 CG 时显示）：
  - 为每个 CG 文件设置文本映射
  - 支持多个 CG 图片

#### 步骤 5：完成

- **预览摘要**：
  - 显示模型名称
  - 统计各类文件数量（模型文件、纹理、动作、表情）
- **执行操作**：
  - 保存文件到 IndexedDB（仅本地文件）
  - 为 URL 导入的文件创建世界书条目（使用原始 URL）
  - 创建所有资源的世界书条目（JSON 格式）
- **完成状态**：显示成功/失败统计信息

### 3. 智能文件处理

#### 文件类型识别

- **模型文件**：
  - `.moc3` - MOC 模型文件
  - `.model3.json` - 模型配置文件（Version 3）
  - `.cdi3.json` - 显示信息文件
- **动作文件**：
  - `.motion3.json` - 动作或表情文件
  - 根据文件名模式自动判断类型
- **图片文件**：
  - `.png`, `.jpg`, `.jpeg` - 需要手动分类

#### GitHub 仓库解析

- **自动识别**：检测到 GitHub 仓库 URL 时，自动解析文件结构
- **文件查找**：
  - 自动查找 `model3.json` 或 `model.json`
  - 从配置文件读取所有相关文件路径
  - 自动下载纹理、动作、表情等文件
- **路径转换**：
  - `github.com/username/repo` → `username.github.io/repo/`
  - `raw.githubusercontent.com/...` → `username.github.io/repo/`

### 4. 世界书条目格式

所有资源以 JSON 格式存储在世界书条目中，便于其他界面解析使用。

#### 模型资源条目

- **条目名称**：`[模型资源] {模型名}`
- **内容格式**（JSON）：

```json
{
  "type": "live2d_model",
  "modelName": "程北极",
  "files": {
    "model3": "indexeddb://程北极/model3.json",
    "moc3": "indexeddb://程北极/model.moc3",
    "textures": ["indexeddb://程北极/texture_00.png"],
    "cdi3": "indexeddb://程北极/cdi3.json"
  },
  "motions": [
    {"name": "idle", "file": "indexeddb://程北极/idle.motion3.json", "group": "default"}
  ],
  "expressions": [
    {"name": "happy", "file": "indexeddb://程北极/happy.exp3.json"}
  ],
  "defaultAnimation": {
    "expression": "happy",
    "motion": "idle",
    "autoLoop": true
  },
  "textMappings": {
    "expression": {
      "happy": "你好呀;高兴"
    },
    "motion": {
      "idle": "待机;站着"
    }
  }
}
```

**文件路径说明**：

- **本地文件**：使用 `indexeddb://模型名/文件名` 格式
- **URL 文件**：直接使用原始 URL（如 `https://example.com/model3.json`）

#### 立绘资源条目

- **条目名称**：`[立绘资源] {角色名}` 或 `[立绘资源]`
- **内容格式**（JSON）：

```json
{
  "type": "sprite",
  "characterName": "程北极",
  "sprites": [
    {
      "name": "normal",
      "file": "indexeddb://程北极/sprite_normal.png",
      "textMappings": ["正常", "普通"]
    }
  ]
}
```

#### 背景资源条目

- **条目名称**：`[背景资源]`
- **内容格式**（JSON）：

```json
{
  "type": "background",
  "backgrounds": [
    {
      "name": "home",
      "file": "indexeddb://backgrounds/home.png",
      "textMappings": ["家中", "家里"]
    }
  ]
}
```

#### CG 资源条目

- **条目名称**：`[CG资源]`
- **内容格式**（JSON）：

```json
{
  "type": "cg",
  "cgs": [
    {
      "name": "cg01",
      "file": "indexeddb://cgs/cg01.png",
      "textMappings": ["第一张CG", "cg01"]
    }
  ]
}
```

### 5. 文件存储机制

#### IndexedDB 存储

- **数据库名称**：`live2d-models-db`
- **存储策略**：
  - **本地文件**：保存到 IndexedDB，使用 `indexeddb://` 路径引用
  - **URL 文件**：**不保存到 IndexedDB**，直接在世界书中使用原始 URL
- **文件 ID 格式**：`${模型名}::${文件名}`（内部使用）
- **世界书路径格式**：
  - 本地文件：`indexeddb://模型名/文件名`
  - URL 文件：`https://example.com/path/to/file.ext`

#### 文件引用处理

- **本地文件**：
  - 上传时保存到 IndexedDB
  - 世界书中使用 `indexeddb://` 协议路径
  - 其他界面通过 `parseIndexedDbUrl` 函数解析并读取
- **URL 文件**：
  - **不下载到 IndexedDB**
  - 直接在世界书中使用原始 URL
  - 其他界面直接通过 URL 加载文件

## 技术实现

### 关键文件

- **`ModelUploadWizard.vue`** - 主组件，实现五步上传流程
- **`composables.ts`** - 组合式函数，包含 URL 导入和文件处理逻辑
- **`worldbookFormat.ts`** - 世界书条目格式化工具，生成 JSON 格式条目
- **`indexedDB.ts`** - IndexedDB 存储工具，处理本地文件存储

### 核心功能模块

#### 文件分类逻辑

```typescript
// 自动识别模型文件
if (filename.endsWith('.moc3')) type = 'moc3';
if (filename.endsWith('.model3.json')) type = 'model3';
if (filename.endsWith('.cdi3.json')) type = 'cdi3';

// 智能识别动作/表情
if (filename.endsWith('.motion3.json')) {
  type = detectMotionType(filename); // 根据文件名模式判断
}

// 图片需要手动分类
if (filename.match(/\.(png|jpg|jpeg)$/)) {
  type = 'unclassified_image'; // 初始为待分类
}
```

#### URL 导入处理

1. **检测 URL 类型**：GitHub 仓库 / 普通 URL
2. **GitHub 仓库**：
   - 规范化 URL（转换为 GitHub Pages）
   - 自动查找 `model3.json`
   - 解析配置文件，收集所有文件 URL
   - 下载文件到虚拟结构
3. **普通 URL**：
   - 直接下载文件
   - 从 Content-Disposition 或 URL 提取文件名
4. **文件处理**：
   - URL 导入的文件**保留原始 URL**
   - 创建 File 对象仅用于界面显示
   - **不保存到 IndexedDB**

#### 世界书条目创建

1. **收集资源数据**：从分类结果和用户设置收集
2. **生成文件路径**：
   - 本地文件：`indexeddb://模型名/文件名`
   - URL 文件：原始 URL
3. **格式化 JSON**：使用 `worldbookFormat.ts` 工具函数
4. **创建条目**：调用 `createWorldbookEntries` 写入世界书

## 使用流程

### 基本使用

1. **进入向导**：在主菜单点击"游戏设置"按钮
2. **步骤 1 - 上传文件**：
   - 选择本地文件上传或输入 URL 导入
   - 可以多次上传，文件会累积
   - 查看已选择文件列表，可移除不需要的文件
3. **步骤 2 - 分类文件**：
   - 输入资源名称
   - 确认自动分类的模型和动作文件
   - 手动分类图片（立绘/背景/CG/纹理）
   - 调整动作/表情类型（如需要）
4. **步骤 3 - 模型设置**（可选）：
   - 编辑模型名称和版本（如有模型文件）
5. **步骤 4 - 资源设置**（可选）：
   - 设置默认动画和表情
   - 为动作/表情添加文本映射
   - 为立绘/背景/CG 添加文本映射
6. **步骤 5 - 完成**：
   - 预览摘要信息
   - 点击"完成并创建世界书条目"
   - 等待处理完成（保存文件、创建条目）

### 高级用法

#### 混合使用本地和 URL 文件

- 可以部分资源从本地上传，部分从 URL 导入
- 本地文件会保存到 IndexedDB
- URL 文件会直接使用原始 URL

#### GitHub 仓库批量导入

1. 输入 GitHub 仓库 URL（如 `https://github.com/username/repo`）
2. 系统自动识别并转换为 GitHub Pages URL
3. 自动查找 `model3.json` 并解析所有文件
4. 批量下载所有相关文件

#### 文本映射批量设置

- 使用分号分隔多个触发文本：`待机;站着;休息`
- 系统会自动解析为标签，便于查看和管理
- 支持为同一资源设置多个映射规则

## 注意事项

### 文件处理

- **模型文件**（`.moc3`, `.model3.json` 等）会被自动识别和分类
- **图片文件**需要手动分类为立绘/背景/CG/纹理
- **动作文件**可手动切换动作/表情类型
- **URL 导入的文件**：如果有正常可访问的 URL，**不会保存到 IndexedDB**，直接使用原始 URL

### 文件路径

- **本地文件**：使用 `indexeddb://模型名/文件名` 格式
- **URL 文件**：使用原始 URL（如 `https://example.com/file.png`）
- 世界书条目中会根据文件来源自动选择正确的路径格式

### 世界书条目

- 所有资源条目使用 JSON 格式，便于解析
- 条目名称使用特定前缀（`[模型资源]`、`[立绘资源]` 等）便于识别
- 使用永不会触发的关键字，确保条目不会被对话触发

### 性能考虑

- 大文件上传可能需要较长时间
- 批量导入时会显示进度和统计信息
- 建议单个资源包不超过 50MB

### 错误处理

- 文件下载失败时会显示错误统计
- 部分文件失败不影响其他文件的处理
- 可以在控制台查看详细错误信息

## 与其他界面的集成

### live2d与galgame界面前端

- 通过解析世界书条目中的 JSON 数据加载资源
- 支持 `indexeddb://` 协议路径（通过 `parseIndexedDbUrl` 函数）
- 支持直接 HTTP/HTTPS URL
- 根据文本映射自动播放动画或显示资源

### 数据流向

```
上传向导 → 保存到 IndexedDB / 使用 URL → 创建世界书条目（JSON）→ 其他界面解析并使用
```

## 后续改进建议

1. **文件来源标识**：在文件对象中添加 `source: 'local' | 'url'` 标识，便于区分处理
2. **URL 验证**：上传前验证 URL 是否可访问，决定是否需要下载到 IndexedDB
3. **批量操作**：支持批量设置文本映射、批量分类等
4. **资源预览**：支持预览图片、模型等资源
5. **导入导出**：支持导出配置、批量导入配置等
