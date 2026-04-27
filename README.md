# GalaxyEpoch 🤖

> 开源大模型聚合客户端 — 轻量化、易部署、永久开源免费

## ✨ 核心特性

- 🖥️ **本地模型自动接入** — 自动扫描 Ollama / LM Studio / LocalAI，一键连接
- 🌐 **全网主流 API 聚合** — 20+ 预设模型：DeepSeek、通义千问、智谱、Kimi、GPT-4o、Claude、Gemini 等
- 💬 **流式对话** — 实时流式输出，支持中断
- 📚 **知识库 / RAG** — 上传文档，AI 基于你的知识回答问题
- 🎨 **AI 绘画** — DALL-E 3 / Stable Diffusion / ComfyUI 本地绘画
- 🧩 **插件系统** — 动态安装插件，Hook 机制扩展功能
- 🌍 **多语言** — 支持中文、英文、日文等 9 种语言
- ☁️ **云端同步** — WebDAV / 自建服务器 / 本地导出
- 🎤 **语音对话** — 语音输入识别 + AI 回复语音朗读
- 🎨 **现代 UI** — 简洁美观的暗色/亮色主题
- 🔒 **本地优先** — 数据全部存储在本地，隐私安全
- 📦 **轻量部署** — 低配电脑也能流畅运行

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装运行

```bash
# 克隆项目
git clone https://github.com/your-username/galaxyepoch.git
cd galaxyepoch

# 安装依赖
npm install

# 启动开发模式
npm start
```

### 打包发布

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### 运行测试

```bash
node test.js
```

## 📖 使用教程

### 1. 连接本地模型

1. 确保 [Ollama](https://ollama.ai) 已安装并运行
2. 在 GalaxyEpoch 中点击「🖥️ 连接本地模型」或侧边栏模型区的 🔄 按钮
3. 自动扫描并列出所有本地可用模型
4. 点击模型即可开始对话

### 2. 配置在线 API

1. 点击 ⚙️ 设置 → API 密钥
2. 填入对应平台的 API Key（未设置的模型可点击"获取密钥"跳转官方）
3. 在模型列表中选择在线模型即可使用

### 3. 开始对话

- 点击「✚ 新建对话」创建新会话
- 从顶部下拉框选择模型
- 输入消息，Enter 发送

### 4. 知识库使用

1. 创建知识库 → 添加文档（支持 .txt / .md 等文本文件）
2. 激活知识库 → 对话时自动注入 RAG 上下文
3. AI 将基于你的文档内容回答问题

### 5. AI 绘画

1. 选择绘画模型（DALL-E 3 / Stable Diffusion / ComfyUI）
2. 输入图片描述
3. 生成图片自动保存到本地

## 🏗️ 项目架构

```
GalaxyEpoch/
├── src/
│   ├── main/                        # Electron 主进程
│   │   ├── index.js                 # 入口 & IPC 注册
│   │   ├── ollama-scanner.js        # 本地模型扫描
│   │   ├── model-manager.js         # 模型管理
│   │   ├── api-client.js            # API 统一客户端
│   │   ├── conversation-manager.js  # 对话管理
│   │   ├── settings-manager.js      # 设置管理
│   │   ├── knowledge-manager.js     # 知识库 & RAG
│   │   ├── painting-manager.js      # AI 绘画
│   │   ├── plugin-manager.js        # 插件系统
│   │   ├── i18n-manager.js          # 国际化
│   │   ├── sync-manager.js          # 云端同步
│   │   ├── voice-manager.js         # 语音对话
│   │   ├── json-store.js            # 本地 JSON 存储
│   │   ├── promo-interface.js       # 推广模块接口契约
│   │   ├── promo-stub.js            # 推广模块开源 stub
│   │   └── locales/                 # 语言包
│   │       ├── zh-CN.json
│   │       ├── en-US.json
│   │       └── ja-JP.json
│   ├── preload/
│   │   ├── index.js                 # 前台安全桥接
│   │   └── admin-preload.js         # 管理员后台桥接
│   └── renderer/                    # 渲染进程 (前端)
│       ├── index.html               # 主界面
│       ├── admin.html               # 管理员后台
│       ├── styles/
│       │   ├── main.css
│       │   ├── chat.css
│       │   ├── sidebar.css
│       │   └── settings.css
│       └── js/
│           └── app.js
├── plugins/                         # 插件目录
│   └── example/                     # 示例插件
├── assets/
│   └── icon.png
├── test.js                          # 单元测试 (31 项)
├── package.json
├── LICENSE
└── README.md
```

## 🔌 支持的模型

### 国内主流
| 平台 | 模型 | 说明 |
|------|------|------|
| DeepSeek | Chat / R1 | 性价比极高，推理强 |
| 通义千问 | Turbo / Plus / Max | 阿里云出品 |
| 智谱 AI | GLM-4 / GLM-4-Flash | 中文能力强 |
| 月之暗面 | Moonshot (Kimi) | 长文本出色 |
| 零一万物 | Yi Lightning | 性价比高 |
| 字节跳动 | 豆包 Pro | 多模态支持 |
| 百度 | 文心一言 4.0 | 百度旗舰 |
| 腾讯 | 混元 Lite | 免费体验 |

### 国际主流
| 平台 | 模型 | 说明 |
|------|------|------|
| OpenAI | GPT-4o / GPT-4o Mini / GPT-3.5 | 综合能力顶级 |
| Anthropic | Claude 3.5 Sonnet / Haiku | 编程推理强 |
| Google | Gemini Pro | 多模态能力 |
| Groq | Llama 3 70B | 极速推理 |
| Mistral | Mistral Large | 欧洲顶尖 |

### 本地模型
| 平台 | 说明 |
|------|------|
| Ollama | 自动扫描 11434 端口，NDJSON 流式 |
| LM Studio | OpenAI 兼容接口，自动扫描 1234 端口 |
| LocalAI | OpenAI 兼容接口，自动扫描 8080 端口 |

## 💰 商业模式

- 软件主体**永久开源免费**，基础功能不设限制
- 用户点击"获取密钥"跳转官方平台（带推广参数），赚取推广佣金
- 我方**不垫付**任何费用，零成本运营
- 用户消费走官方渠道，我只赚取 API 调用流量分成

## 📜 开源协议

MIT License - 自由使用、修改、分发

### 商业模块声明

以下文件不在 MIT 协议覆盖范围内，为 GalaxyEpoch Team 专有：
- `src/main/promo-core.js` — 推广链接与佣金核心逻辑
- `src/renderer/admin.html` — 管理员后台
- `src/preload/admin-preload.js` — 管理员后台桥接

你**不可以**：
1. 逆向工程、反编译这些商业模块
2. 修改、重定向或干扰推广/佣金追踪逻辑
3. 替换或绕过推广链接系统来转移佣金

你**可以**：
1. Fork、修改、分发所有其他源代码（MIT 条款）
2. 本地构建运行，用于开发和测试
3. 提交 Pull Request 改进开源部分
4. 创建自己的推广模块（实现 `promo-interface.js` 接口即可）

## 🛣️ 后续规划

- [x] 知识库 / RAG 支持
- [x] AI 绘画集成
- [x] 插件系统
- [x] 多语言支持
- [x] 云端同步
- [x] 语音对话
- [ ] 向量数据库集成（Pinecone / Milvus）
- [ ] 多人协作对话
- [ ] 移动端适配
- [ ] 浏览器扩展
