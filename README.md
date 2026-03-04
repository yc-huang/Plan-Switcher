# Plan Switcher

**Plan Switcher** 是一个为 Claude Code、Open Claw 等 AI 编码助手和Agent应用设计的智能代理工具。当某个低价套餐遇到限流时，自动切换到其他可用套餐，让你无需购买昂贵的高级套餐，只需聚合多个入门级套餐即可享受不间断服务。开源**免费**,纯本地运行，**安全**可靠。

[English](#english) | [中文](#中文)

---

## 中文

### 功能特点

- 🔄 **自动切换**：当 API 返回 429 限流错误时，自动切换到下一个可用的 Plan
- ⚡ **无缝代理**：兼容 OpenAI API 格式，可直接替换 base_url 使用
- 🌐 **多供应商支持**：支持 Anthropic、OpenAI、DeepSeek、Qwen 等主流 AI 供应商
- 💻 **Coding Plan 支持**：内置国内主流供应商的 Coding Plan 专用端点
- 📊 **管理界面**：内置 Web 管理界面，支持中英文切换
- 🚀 **自动打开浏览器**：启动时自动打开管理界面（可用 `--no-browser` 禁用）
- 💾 **数据持久化**：配置和 Plan 数据自动保存到本地文件

### 快速开始

#### 1. 启动服务

**Linux:**
```bash
./plan-switcher-linux
```

**macOS:**
```bash
./plan-switcher-macos
```

**Windows:**
```cmd
plan-switcher-win.exe
```

启动后会自动打开浏览器访问管理界面。如需禁用自动打开：
```bash
./plan-switcher-linux --no-browser
# 或
./plan-switcher-linux -n
```

#### 2. 添加 Plan

在浏览器管理界面中：
1. 点击 "Plans 管理" 标签
2. 点击 "+ 添加 Plan"
3. 填写 Plan ID、Provider、API Key 等信息
4. 点击 "添加"

#### 3. 配置工具

将你的 AI 工具的 base_url 指向代理地址：

```bash
# 环境变量方式
export ANTHROPIC_BASE_URL="http://127.0.0.1:8765/proxy/v1"
export ANTHROPIC_API_KEY="any-key"  # 代理会自动替换

# 使用 Claude Code
claude

# 使用 Cursor IDE
# 在设置中配置 Base URL: http://127.0.0.1:8765/proxy/v1
```

### 应用场景：OpenClaw

[OpenClaw](https://github.com/OpenClawHQ/openclaw) 是一款跨平台 AI 助手工具，支持 macOS/Linux/Windows(WSL2)。它可以集成多种 AI 编程工具（如 Claude Code、Codex CLI 等），并通过 Skills 功能实现自动化工作流。

#### 为什么选择 OpenClaw + Plan Switcher？

1. **统一入口管理**：OpenClaw 可以通过一个界面调用多个 AI 编程工具，配合 Plan Switcher 实现多 Plan 自动切换
2. **成本优化**：OpenClaw 支持接入国产 Coding Plan（如火山的方舟 Coding Plan、阿里云百炼等），Plan Switcher 可以在多个 Plan 间自动切换
3. **无感切换**：当一个 Plan 限流时，自动切换到下一个可用 Plan，保证工作流不中断

#### OpenClaw 配置方法

**方式一：通过配置文件**

编辑 OpenClaw 配置文件（通常位于 `~/.openclaw/config.json` 或 `~/.openclaw/models.json`）：

```json
{
  "models": {
    "providers": {
      "plan-switcher": {
        "name": "Plan Switcher",
        "baseURL": "http://127.0.0.1:8765/proxy/v1",
        "apiKey": "any-key",
        "models": ["claude-sonnet-4", "deepseek-chat", "GLM-5"]
      }
    }
  }
}
```

**方式二：通过命令行配置**

```bash
# 配置 OpenAI 兼容端点
openclaw auth openai baseURL http://127.0.0.1:8765/proxy/v1
openclaw auth openai apiKey any-key

# 或配置 Anthropic 兼容端点
openclaw auth anthropic baseURL http://127.0.0.1:8765/proxy/v1
openclaw auth anthropic apiKey any-key
```

**方式三：配置多个 Coding Plan 提供商**

如果使用不同供应商的 Coding Plan，可以为每个 Plan 配置独立的 Provider：

```json
{
  "models": {
    "providers": {
      "zhipu-coding": {
        "name": "智谱 GLM Coding",
        "baseURL": "https://open.bigmodel.cn/api/anthropic",
        "apiKey": "your-zhipu-api-key",
        "models": ["GLM-5"]
      },
      "doubao-coding": {
        "name": "火山方舟 Coding",
        "baseURL": "https://ark.cn-beijing.volces.com/api/coding",
        "apiKey": "your-doubao-api-key",
        "models": ["ark-code-latest"]
      },
      "qwen-coding": {
        "name": "阿里云百炼 Coding",
        "baseURL": "https://coding.dashscope.aliyuncs.com/v1",
        "apiKey": "sk-sp-your-key",
        "models": ["Qwen3-Coder-Next"]
      }
    }
  }
}
```

然后在 Plan Switcher 管理界面中添加这些 Plan，系统会在一个 Plan 限流时自动切换到下一个。

#### 结合 Claude Code Skill

OpenClaw 的 Coding Agent Skill 可以直接调用 Claude Code，配合 Plan Switcher 使用：

```bash
# 先启动 Plan Switcher
./plan-switcher-linux

# 配置环境变量后启动 OpenClaw
export ANTHROPIC_BASE_URL="http://127.0.0.1:8765/proxy/v1"
export ANTHROPIC_API_KEY="any-key"
openclaw
```

这样当 Claude Code 通过 OpenClaw 调用时，如果遇到限流，Plan Switcher 会自动切换到备用 Plan。

### API 端点

| 端点 | 说明 |
|------|------|
| `http://127.0.0.1:8765` | 管理界面 |
| `http://127.0.0.1:8765/proxy/v1` | 代理端点 |
| `http://127.0.0.1:8765/api/status` | 状态 API |
| `http://127.0.0.1:8765/api/plans` | Plans 管理 API |
| `http://127.0.0.1:8765/api/config` | 配置 API |

### 支持的供应商

#### 国际供应商

| Provider | 端点 | 说明 |
|----------|------|------|
| Anthropic | `https://api.anthropic.com` | Claude 模型官方 API |
| OpenAI | `https://api.openai.com` | GPT 模型官方 API |
| OpenRouter | `https://openrouter.ai/api` | 多模型聚合平台 |
| Google | `https://generativelanguage.googleapis.com` | Gemini 模型 |
| Mistral AI | `https://api.mistral.ai` | Mistral 模型 |

#### 国内供应商 - 标准 API

| Provider | 端点 | 说明 |
|----------|------|------|
| DeepSeek | `https://api.deepseek.com` | DeepSeek V3/R1 |
| 智谱AI | `https://open.bigmodel.cn/api/paas/v4` | GLM 系列模型 |
| Moonshot | `https://api.moonshot.cn/v1` | Kimi 模型 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Qwen 系列模型 |
| 文心一言 | `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop` | ERNIE 模型 |
| MiniMax | `https://api.minimax.chat/v1` | MiniMax 模型 |
| 豆包 | `https://ark.cn-beijing.volces.com/api/v3` | 字节跳动大模型 |
| 零一万物 | `https://api.lingyiwanwu.com/v1` | Yi 系列模型 |
| SiliconFlow | `https://api.siliconflow.cn/v1` | 多模型聚合平台 |

#### 💻 Coding Plan 专用端点（推荐用于 AI 编程工具）

> ⚠️ **重要**：这些端点专为 AI 编程工具（如 Claude Code、Cursor、OpenClaw）优化，需要单独订阅对应的 Coding Plan 套餐。

| Provider | 端点 | 推荐模型 | 说明 |
|----------|------|---------|------|
| **智谱AI GLM Coding** | `https://open.bigmodel.cn/api/anthropic` | `GLM-5` | Anthropic 兼容端点 |
| **阿里云百炼 Coding** | `https://coding.dashscope.aliyuncs.com/v1` | `Qwen3-Coder-Next` | OpenAI 兼容，Key 格式 `sk-sp-xxxxx` |
| **月之暗面 Kimi Coding** | `https://api.moonshot.cn/anthropic` | `kimi-k2` | Anthropic 兼容端点 |
| **MiniMax Coding (国内)** | `https://api.minimax.chat/anthropic` | `MiniMax-M2.5` | Anthropic 兼容端点 |
| **MiniMax Coding (国际)** | `https://api.minimax.io/anthropic` | `MiniMax-M2.5` | Anthropic 兼容端点 |
| **火山方舟 Coding (Anthropic)** | `https://ark.cn-beijing.volces.com/api/coding` | `ark-code-latest` | Anthropic 兼容端点 |
| **火山方舟 Coding (OpenAI)** | `https://ark.cn-beijing.volces.com/api/coding/v3` | `ark-code-latest` | OpenAI 兼容端点 |

### 为什么需要区分 Coding Plan 端点？

很多国内供应商推出了专门的 **Coding Plan（编程套餐）**，相比标准 API 有以下区别：

1. **不同的计费方式**：Coding Plan 通常是固定月费，适合高频编程使用
2. **专用的 API 端点**：需要使用专用的 Base URL，否则无法享受套餐额度
3. **特殊的 API Key 格式**：如阿里云百炼 Coding Plan 的 Key 格式为 `sk-sp-xxxxx`
4. **针对编程场景优化**：模型参数和限制针对代码生成任务调优
5. **检查客户端**：部分供应商（如 Kimi Coding）会检查请求来源，只允许特定的编程工具

### Coding Plan 对比

| 供应商 | 套餐价格 | 支持模型 | 特点 |
|--------|---------|----------|------|
| 智谱AI | ¥20-100/月 | GLM-5, GLM-4.7 | 国内最早推出，支持20+编程工具，Anthropic 兼容 |
| 阿里云百炼 | ¥7.9起/月 | Qwen3.5-Plus, Qwen3-Coder-Next | API Key格式特殊 `sk-sp-xxxxx`，聚合多家模型 |
| 月之暗面 Kimi | ¥49/月 | Kimi-K2, Kimi-K2.5 | Anthropic 兼容端点，视觉编程能力强 |
| MiniMax | $10/月 | MiniMax-M2.5 | 国内外双端点，性价比高 |
| 火山引擎方舟 | ¥8.9起/月 | Doubao-Seed-Code, GLM-4.7, DeepSeek-V3.2, Kimi-K2 | 多模型聚合，支持 Auto 模式自动选择 |

### 配置说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| rateLimitBackoffBase | 60 | 限流基础退避时间（秒） |
| rateLimitBackoffMultiplier | 5 | 退避倍数 |
| rateLimitBackoffMax | 3600 | 最大退避时间（秒） |
| billingBackoffBase | 18000 | 计费错误基础退避时间（秒） |
| billingBackoffMax | 86400 | 计费错误最大退避时间（秒） |
| healthCheckEnabled | true | 是否启用健康检查 |
| healthCheckInterval | 300 | 健康检查间隔（秒） |
| maxConsecutiveErrors | 5 | 最大连续错误次数 |

### 从源码构建

需要 Node.js 18+ 环境：

```bash
# 安装依赖
npm install

# 构建所有平台
npm run build:all

# 或构建特定平台
npm run build:linux
npm run build:mac
npm run build:win
```

---

## English
**Plan-Switcher** is a smart proxy tool designed for AI coding agents like Claude Code, Open Claw, and similar services. It automatically switches between multiple low-cost coding plans when one hits rate limits or quota exhaustion, allowing you to enjoy uninterrupted service without purchasing expensive high-tier plans.

Instead of relying on a single costly subscription, you can aggregate several affordable entry-level plans and let **Plan-Switcher** handle the failover seamlessly. This ensures your coding workflow continues smoothly while saving costs.

### Features

- 🔄 **Auto-Switch**: Automatically switches to next available Plan when API returns 429 rate limit error
- ⚡ **Seamless Proxy**: Compatible with OpenAI API format, just replace base_url
- 🌐 **Multi-Provider Support**: Supports Anthropic, OpenAI, DeepSeek, Qwen and more
- 📊 **Web Dashboard**: Built-in web management UI with Chinese/English language switching
- 🚀 **Auto-Open Browser**: Automatically opens browser on startup (can disable with `--no-browser`)
- 💾 **Data Persistence**: Configuration and Plan data automatically saved to local files

### Quick Start

#### 1. Start the Server

**Linux:**
```bash
./plan-switcher-linux
```

**macOS:**
```bash
./plan-switcher-macos
```

**Windows:**
```cmd
plan-switcher-win.exe
```

Browser will automatically open the management UI. To disable:
```bash
./plan-switcher-linux --no-browser
# or
./plan-switcher-linux -n
```

#### 2. Add a Plan

In the browser management UI:
1. Click "Plans" tab
2. Click "+ Add Plan"
3. Fill in Plan ID, Provider, API Key etc.
4. Click "Add"

#### 3. Configure Your Tools

Point your AI tool's base_url to the proxy:

```bash
# Environment variables
export ANTHROPIC_BASE_URL="http://127.0.0.1:8765/proxy/v1"
export ANTHROPIC_API_KEY="any-key"  # Proxy will auto-replace

# Use with Claude Code
claude

# Use with Cursor IDE
# Configure Base URL in settings: http://127.0.0.1:8765/proxy/v1
```

### Use Case: OpenClaw

[OpenClaw](https://github.com/OpenClawHQ/openclaw) is a cross-platform AI assistant tool supporting macOS/Linux/Windows(WSL2). It integrates multiple AI coding tools (like Claude Code, Codex CLI, etc.) and enables automated workflows through Skills.

#### Why OpenClaw + Plan Switcher?

1. **Unified Entry Point**: OpenClaw can call multiple AI coding tools from one interface, with Plan Switcher handling automatic multi-Plan switching
2. **Cost Optimization**: OpenClaw supports Chinese Coding Plans (like Volcano Ark, Alibaba Qwen), and Plan Switcher automatically switches between plans
3. **Seamless Failover**: When one Plan hits rate limits, automatically switch to the next available Plan

#### OpenClaw Configuration

**Method 1: Via Config File**

Edit OpenClaw config file (usually at `~/.openclaw/config.json` or `~/.openclaw/models.json`):

```json
{
  "models": {
    "providers": {
      "plan-switcher": {
        "name": "Plan Switcher",
        "baseURL": "http://127.0.0.1:8765/proxy/v1",
        "apiKey": "any-key",
        "models": ["claude-sonnet-4", "deepseek-chat", "GLM-5"]
      }
    }
  }
}
```

**Method 2: Via Command Line**

```bash
# Configure OpenAI compatible endpoint
openclaw auth openai baseURL http://127.0.0.1:8765/proxy/v1
openclaw auth openai apiKey any-key

# Or configure Anthropic compatible endpoint
openclaw auth anthropic baseURL http://127.0.0.1:8765/proxy/v1
openclaw auth anthropic apiKey any-key
```

**Method 3: Configure Multiple Coding Plan Providers**

For using different Coding Plan providers, configure each Plan as a separate Provider:

```json
{
  "models": {
    "providers": {
      "zhipu-coding": {
        "name": "Zhipu GLM Coding",
        "baseURL": "https://open.bigmodel.cn/api/anthropic",
        "apiKey": "your-zhipu-api-key",
        "models": ["GLM-5"]
      },
      "doubao-coding": {
        "name": "Volcano Ark Coding",
        "baseURL": "https://ark.cn-beijing.volces.com/api/coding",
        "apiKey": "your-doubao-api-key",
        "models": ["ark-code-latest"]
      },
      "qwen-coding": {
        "name": "Alibaba Qwen Coding",
        "baseURL": "https://coding.dashscope.aliyuncs.com/v1",
        "apiKey": "sk-sp-your-key",
        "models": ["Qwen3-Coder-Next"]
      }
    }
  }
}
```

Then add these Plans in Plan Switcher admin UI. The system will automatically switch to the next Plan when one is rate-limited.

#### Using with Claude Code Skill

OpenClaw's Coding Agent Skill can directly invoke Claude Code with Plan Switcher:

```bash
# Start Plan Switcher first
./plan-switcher-linux

# Configure environment and start OpenClaw
export ANTHROPIC_BASE_URL="http://127.0.0.1:8765/proxy/v1"
export ANTHROPIC_API_KEY="any-key"
openclaw
```

When Claude Code is invoked through OpenClaw and hits rate limits, Plan Switcher will automatically switch to a backup Plan.

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `http://127.0.0.1:8765` | Management UI |
| `http://127.0.0.1:8765/proxy/v1` | Proxy endpoint |
| `http://127.0.0.1:8765/api/status` | Status API |
| `http://127.0.0.1:8765/api/plans` | Plans management API |
| `http://127.0.0.1:8765/api/config` | Configuration API |

### Supported Providers

#### International Providers

| Provider | Endpoint | Description |
|----------|----------|-------------|
| Anthropic | `https://api.anthropic.com` | Claude models official API |
| OpenAI | `https://api.openai.com` | GPT models official API |
| OpenRouter | `https://openrouter.ai/api` | Multi-model aggregator |
| Google | `https://generativelanguage.googleapis.com` | Gemini models |
| Mistral AI | `https://api.mistral.ai` | Mistral models |

#### Chinese Providers - Standard API

| Provider | Endpoint | Description |
|----------|----------|-------------|
| DeepSeek | `https://api.deepseek.com` | DeepSeek V3/R1 |
| Zhipu AI | `https://open.bigmodel.cn/api/paas/v4` | GLM series models |
| Moonshot | `https://api.moonshot.cn/v1` | Kimi models |
| Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Qwen series models |
| ERNIE | `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop` | ERNIE models |
| MiniMax | `https://api.minimax.chat/v1` | MiniMax models |
| Doubao | `https://ark.cn-beijing.volces.com/api/v3` | ByteDance models |
| Yi | `https://api.lingyiwanwu.com/v1` | Yi series models |
| SiliconFlow | `https://api.siliconflow.cn/v1` | Multi-model aggregator |

#### 💻 Coding Plan Specific Endpoints (Recommended for AI Coding Tools)

> ⚠️ **Important**: These endpoints are optimized for AI coding tools (Claude Code, Cursor, OpenClaw, etc.) and require separate Coding Plan subscription.

| Provider | Endpoint | Recommended Model | Description |
|----------|----------|------------------|-------------|
| **Zhipu AI GLM Coding** | `https://open.bigmodel.cn/api/anthropic` | `GLM-5` | Anthropic compatible |
| **Alibaba Qwen Coding** | `https://coding.dashscope.aliyuncs.com/v1` | `Qwen3-Coder-Next` | OpenAI compatible, Key format `sk-sp-xxxxx` |
| **Kimi Coding Plan** | `https://api.moonshot.cn/anthropic` | `kimi-k2` | Anthropic compatible |
| **MiniMax Coding (China)** | `https://api.minimax.chat/anthropic` | `MiniMax-M2.5` | Anthropic compatible |
| **MiniMax Coding (International)** | `https://api.minimax.io/anthropic` | `MiniMax-M2.5` | Anthropic compatible |
| **Volcano Ark Coding (Anthropic)** | `https://ark.cn-beijing.volces.com/api/coding` | `ark-code-latest` | Anthropic compatible |
| **Volcano Ark Coding (OpenAI)** | `https://ark.cn-beijing.volces.com/api/coding/v3` | `ark-code-latest` | OpenAI compatible |

### Why Separate Coding Plan Endpoints?

Many Chinese providers offer specialized **Coding Plans** with these differences from standard API:

1. **Different Billing**: Coding Plans usually have fixed monthly fees, suitable for high-frequency programming use
2. **Dedicated Endpoints**: Requires specific Base URL to access plan benefits
3. **Special API Key Format**: e.g., Alibaba Qwen Coding Plan uses `sk-sp-xxxxx` format
4. **Programming Optimized**: Model parameters and limits tuned for code generation tasks
5. **Client Verification**: Some providers (like Kimi Coding) check request source and only allow specific coding tools

### Coding Plan Comparison

| Provider | Price | Supported Models | Features |
|----------|-------|------------------|----------|
| Zhipu AI | ¥20-100/month | GLM-5, GLM-4.7 | First to launch, supports 20+ coding tools, Anthropic compatible |
| Alibaba Qwen | ¥7.9+/month | Qwen3.5-Plus, Qwen3-Coder-Next | Special API Key format `sk-sp-xxxxx`, multi-provider aggregation |
| Kimi (Moonshot) | ¥49/month | Kimi-K2, Kimi-K2.5 | Anthropic compatible endpoint, strong visual coding |
| MiniMax | $10/month | MiniMax-M2.5 | Dual endpoints (China/International), great value |
| Volcano Ark | ¥8.9+/month | Doubao-Seed-Code, GLM-4.7, DeepSeek-V3.2, Kimi-K2 | Multi-model aggregation, Auto mode for automatic selection |

### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| rateLimitBackoffBase | 60 | Base backoff time for rate limit (seconds) |
| rateLimitBackoffMultiplier | 5 | Backoff multiplier |
| rateLimitBackoffMax | 3600 | Max backoff time (seconds) |
| billingBackoffBase | 18000 | Base backoff for billing errors (seconds) |
| billingBackoffMax | 86400 | Max backoff for billing errors (seconds) |
| healthCheckEnabled | true | Enable health check |
| healthCheckInterval | 300 | Health check interval (seconds) |
| maxConsecutiveErrors | 5 | Max consecutive errors |

### Build from Source

Requires Node.js 18+:

```bash
# Install dependencies
npm install

# Build for all platforms
npm run build:all

# Or build for specific platform
npm run build:linux
npm run build:mac
npm run build:win
```

---

## License

MIT
