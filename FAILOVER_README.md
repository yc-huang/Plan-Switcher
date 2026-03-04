# OpenClaw Failover - 增强方案

## 概述

这是一个无需安装任何额外依赖的 OpenClaw 限流自动切换方案，基于现有的 Next.js 项目实现。

### 特性

- ✅ **零额外依赖** - 直接使用现有 Next.js 项目
- ✅ **Web 管理界面** - 可视化配置和状态监控
- ✅ **自动故障转移** - 限流时自动切换到备用 Plan
- ✅ **指数退避策略** - 智能退避避免频繁切换
- ✅ **状态持久化** - 数据保存在本地文件
- ✅ **安全设计** - 默认只监听 localhost

---

## 快速开始

### 1. 启动服务

```bash
cd /home/z/my-project
bun run dev
```

服务将在 `http://localhost:3000` 启动。

### 2. 访问管理面板

打开浏览器访问：`http://localhost:3000`

你将看到 Failover 管理面板，可以：
- 查看所有 Plan 的状态
- 添加/删除/重置 Plans
- 查看请求统计和切换次数

### 3. 添加 Coding Plans

在管理面板中点击 "添加 Plan"，填写：
- **Plan ID**: 唯一标识符（如 `claude-primary`）
- **Provider**: 选择 API 提供商
- **API Key**: 你的 API Key
- **Priority**: 优先级（数字越小越优先）

### 4. 使用代理 API

配置你的客户端使用代理端点：

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/api/failover/proxy/v1",
    api_key="any-key"  # 代理会自动替换
)

response = client.chat.completions.create(
    model="claude-sonnet-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

## API 端点

### 代理端点

```
POST http://localhost:3000/api/failover/proxy/v1/chat/completions
POST http://localhost:3000/api/failover/proxy/v1/messages
```

### 管理端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/failover/status` | GET | 获取系统状态 |
| `/api/failover/plans` | GET/POST/PUT/DELETE | Plan 管理 |
| `/api/failover/config` | GET/PUT | 配置管理 |
| `/api/failover/reset` | POST | 重置 Plan |

---

## 工作原理

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   客户端      │────▶│  Failover Proxy     │────▶│  目标 API    │
│  (IDE/App)   │     │  localhost:3000     │     │  (Anthropic) │
└──────────────┘     └─────────────────────┘     └──────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Plan 1   │   │ Plan 2   │   │ Plan 3   │
        │ Primary  │   │ Backup   │   │ Fallback │
        └──────────┘   └──────────┘   └──────────┘
```

1. 客户端请求发送到代理端点
2. 代理选择一个可用的 Coding Plan（优先级高的优先）
3. 使用该 Plan 的 API Key 转发请求
4. 如果遇到限流（429），自动切换到下一个 Plan
5. Plan 进入冷却状态，避免频繁切换
6. 所有 Plan 都失败时返回 503

---

## 退避策略

### 限流退避

| 失败次数 | 等待时间 |
|---------|---------|
| 1 | 60秒 |
| 2 | 5分钟 |
| 3 | 25分钟 |
| 4+ | 1小时（最大） |

### 计费错误退避

| 失败次数 | 等待时间 |
|---------|---------|
| 1 | 5小时 |
| 2 | 10小时 |
| 3+ | 24小时（最大） |

---

## 安全说明

### 本地开发安全

1. **默认监听 localhost** - 服务只监听在 `127.0.0.1`，外部无法访问
2. **API Key 本地存储** - 密钥保存在 `.failover-data/` 目录
3. **无网络暴露** - 不需要开放任何端口给外部

### 生产环境建议

如需在生产环境使用，请：

1. **添加认证** - 实现 API 认证机制
2. **使用 HTTPS** - 配置 TLS 证书
3. **限制访问 IP** - 只允许特定 IP 访问
4. **加密存储** - 对 API Key 进行加密存储

---

## 文件结构

```
/home/z/my-project/
├── .failover-data/           # 数据目录（自动创建）
│   ├── config.json          # Plans 配置
│   └── state.json           # 运行时状态
├── src/
│   ├── app/
│   │   ├── page.tsx         # 管理面板 UI
│   │   └── api/failover/    # API 路由
│   │       ├── status/      # 状态查询
│   │       ├── plans/       # Plan 管理
│   │       ├── config/      # 配置管理
│   │       ├── reset/       # 重置 API
│   │       └── proxy/       # 代理转发
│   └── lib/failover/
│       ├── types.ts         # 类型定义
│       └── plan-manager.ts  # 核心逻辑
```

---

## 常见问题

### Q: 如何查看当前使用的 Plan？

A: 查看响应头 `X-Failover-Plan`，或访问管理面板。

### Q: Plan 进入冷却后如何恢复？

A: 等待冷却时间结束，或在管理面板点击"重置"。

### Q: 如何配置跨 Provider 切换？

A: 添加不同 Provider 的 Plans，系统会按优先级自动切换。

### Q: 数据存储在哪里？

A: 数据存储在项目根目录的 `.failover-data/` 文件夹中。

---

## 监控与日志

### 查看日志

```bash
# 开发环境日志直接输出到控制台
bun run dev

# 查看状态文件
cat .failover-data/state.json
cat .failover-data/config.json
```

### 状态 API

```bash
curl http://localhost:3000/api/failover/status | jq
```

---

## 与 OpenClaw 内置功能对比

| 功能 | OpenClaw 内置 | 本方案 |
|------|--------------|--------|
| Profile 轮换 | ✅ | ✅ |
| Model Fallback | ✅ | ✅ |
| Web 管理界面 | ❌ | ✅ |
| 状态 API | ❌ | ✅ |
| 手动重置 | ❌ | ✅ |
| 实时监控 | ❌ | ✅ |
| 自定义退避 | ⚠️ 有限 | ✅ |

---

## 推荐配置

### 最小配置（2个 Plans）

```
Plan 1: claude-primary (priority: 0)
Plan 2: claude-backup (priority: 1)
```

### 推荐配置（4个 Plans）

```
Plan 1: claude-primary (priority: 0) - 主账号
Plan 2: claude-backup (priority: 1) - 备用账号（同平台）
Plan 3: openai-gpt4 (priority: 2) - 跨平台备用
Plan 4: openrouter (priority: 3) - 聚合平台备用
```
