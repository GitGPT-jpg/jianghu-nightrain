[English](README.md) | **简体中文**

# 江湖夜雨十年灯

一个带 RPG 机制的游戏化个人成长系统 —— AI 自动拆解目标、任务执行奖励经验与恒力、多端云同步、PWA 与 Electron 桌面应用。

## ✨ 功能特性

- **🏠 极简首页** — 聚焦视图：当前任务、阶段进度、恒力与连续天数
- **📊 系统面板** — 全览主线任务、阶段、成就称号、属性、奖励池与激励卡
- **🤖 AI 自动规划** — 输入目标、截止日期、完成奖励，AI 自动生成阶段、长期任务与每日小任务
- **☁️ 云端同步** — 基于 Supabase 的邮箱魔法链接无密码登录，支持多端状态同步
- **📱 PWA** — 可在任意移动端或桌面浏览器安装为 App
- **🖥️ Electron 桌面** — 原生桌面壳，支持 Windows NSIS 安装包

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15、React 19、TypeScript、Tailwind CSS v4 |
| 后端 | Next.js API Routes（无服务器） |
| 数据库 | Supabase（PostgreSQL + 行级安全） |
| AI | OpenAI 兼容 API — 默认 `gpt-4.1-mini`，支持 DeepSeek / Groq / Ollama |
| 桌面 | Electron 41 + electron-builder |
| 认证 | Supabase 魔法链接（无密码） |

## 🚀 快速开始

**前置要求**：Node.js 18+、pnpm（`npm install -g pnpm`）

```bash
git clone https://github.com/GitGPT-jpg/jianghu-nightrain.git
cd jianghu-nightrain
pnpm install
pnpm dev          # → http://localhost:3000
```

## ⚙️ 环境变量

将 `.env.example` 复制为 `.env.local`：

```env
# Supabase — 可选，不填也可完整离线使用
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_INSPIRATION_BUCKET=inspiration

# OpenAI 兼容 API — AI 规划必填
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
```

## 🖥️ 桌面应用

```bash
pnpm desktop:dev    # 以开发模式打开 Electron 壳
pnpm desktop:build  # 构建 Windows 安装包 → desktop-dist/
```

## ☁️ 开启云端同步

1. 在 [supabase.com](https://supabase.com) 创建免费项目
2. 在 `.env.local` 中填入 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 在 **Supabase SQL Editor** 中执行 `supabase/schema.sql` 中的内容
4. 重新启动开发服务器

## 🤖 AI 自动规划

系统面板调用 `/api/goal-plan`（Next.js API Route）：

| 步骤 | 说明 |
|------|------|
| 输入 | 目标描述、截止时间、完成奖励 |
| 输出 | 阶段拆解、每周长期任务、每日小任务 |
| 写入 | 自动填充主线、阶段列表、任务列表、奖励池 |

将 `OPENAI_BASE_URL` 指向任意 OpenAI 兼容端点（DeepSeek、Groq、Ollama 等）即可切换模型。

## 🎮 成长系统机制

| 机制 | 说明 |
|------|------|
| **经验值（XP）** | 完成任务获得，按难度加权 |
| **恒力** | 每日意志力资源 |
| **阶段** | 每条主线 3–5 个阶段，带进度追踪 |
| **属性** | 自定义身体/成长数据，支持历史记录 |
| **称号** | 达成里程碑解锁成就徽章 |
| **奖励** | 用金币兑换现实奖励 |
| **激励卡** | 励志名言与图片 |

## 📁 项目结构

```
src/
├── app/
│   ├── api/goal-plan/      # AI 规划接口
│   ├── auth/               # Supabase 登录回调
│   ├── system/             # 系统面板页
│   └── page.tsx            # 极简首页
├── components/             # UI 组件
├── hooks/                  # 共享状态 Hook
└── lib/
    ├── engine.ts           # 成长机制引擎
    ├── types.ts            # TypeScript 类型定义
    ├── goal-plan.ts        # AI 规划解析与状态写入
    ├── supabase.ts         # Supabase 客户端（浏览器）
    └── supabase-server.ts  # Supabase 客户端（服务端）
supabase/
└── schema.sql              # PostgreSQL 数据库结构 + RLS 策略
electron/
└── main.cjs                # Electron 主进程
```

## 许可证

[MIT](LICENSE)
