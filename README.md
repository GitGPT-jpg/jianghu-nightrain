**English** | [简体中文](README.zh.md)

# 江湖夜雨十年灯

A gamified personal growth system with RPG mechanics — AI-powered goal decomposition, task execution, XP & stamina rewards, multi-device cloud sync, PWA, and Electron desktop app.

## ✨ Features

- **🏠 Minimalist Dashboard** — Focus view: active tasks, current phase progress, and streak counter
- **📊 System Panel** — Full overview of main quests, phases, achievement titles, attributes, rewards pool, and inspiration cards
- **🤖 AI Planning** — Enter a goal, deadline, and reward; AI auto-generates phases, weekly long-term tasks, and daily small tasks
- **☁️ Cloud Sync** — Passwordless email magic-link login via Supabase with multi-device state sync
- **📱 PWA** — Install as an app on any mobile or desktop browser
- **🖥️ Electron Desktop** — Native desktop shell with Windows NSIS installer

## 🛠 Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| AI | OpenAI-compatible API — default `gpt-4.1-mini`, works with DeepSeek / Groq / Ollama |
| Desktop | Electron 41 + electron-builder |
| Auth | Supabase magic-link (passwordless) |

## 🚀 Quick Start

**Prerequisites**: Node.js 18+, pnpm (`npm install -g pnpm`)

```bash
git clone https://github.com/GitGPT-jpg/jianghu-nightrain.git
cd jianghu-nightrain
pnpm install
pnpm dev          # → http://localhost:3000
```

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local`:

```env
# Supabase — optional, app works fully offline without these
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_INSPIRATION_BUCKET=inspiration

# OpenAI-compatible API — required for AI planning
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
```

## 🖥️ Desktop App

```bash
pnpm desktop:dev    # Open Electron shell in dev mode
pnpm desktop:build  # Build Windows installer → desktop-dist/
```

## ☁️ Enable Cloud Sync

1. Create a free project at [supabase.com](https://supabase.com)
2. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
3. Run the schema in **Supabase SQL Editor**: copy from `supabase/schema.sql`
4. Restart the dev server

## 🤖 AI Planning

The system panel calls `/api/goal-plan` (Next.js API Route):

| Step | Detail |
|------|--------|
| Input | Goal description, target deadline, completion reward |
| Output | Phase breakdown, weekly long-term tasks, daily small tasks |
| Write-back | Populates main quest, phases, task list, and reward pool automatically |

Set `OPENAI_BASE_URL` to use any OpenAI-compatible endpoint (DeepSeek, Groq, Ollama, etc.).

## 🎮 Growth System Mechanics

| Mechanic | Description |
|----------|-------------|
| **XP** | Earned by completing tasks, scaled by difficulty |
| **Stamina (恒力)** | Daily willpower resource |
| **Phases** | Each main quest has 3–5 phases with progress tracking |
| **Attributes** | Custom body/growth stats with measurement history |
| **Titles** | Achievement badges unlocked by milestones |
| **Rewards** | Coin-gated real-world rewards to redeem |
| **Inspiration Cards** | Motivational quotes and images |

## 📁 Project Structure

**[🌐 Live Demo →](https://gitgpt-jpg.github.io/jianghu-nightrain/)**

```
src/
├── app/
│   ├── api/goal-plan/      # AI planning endpoint
│   ├── auth/               # Supabase auth callback
│   ├── system/             # System panel page
│   └── page.tsx            # Minimalist home
├── components/             # UI components
├── hooks/                  # Shared state hook
└── lib/
    ├── engine.ts           # Growth mechanics engine
    ├── types.ts            # TypeScript interfaces
    ├── goal-plan.ts        # AI plan parser & state applier
    ├── supabase.ts         # Supabase client (browser)
    └── supabase-server.ts  # Supabase client (server)
supabase/
└── schema.sql              # PostgreSQL schema + RLS policies
electron/
└── main.cjs                # Electron main process
```

## License

[MIT](LICENSE)
