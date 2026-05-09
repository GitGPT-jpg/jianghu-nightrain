"use client";

import Link from "next/link";
import { ArrowRight, Check, Coins, ListTodo, Waves } from "lucide-react";

import { useSharedAppState } from "@/hooks/use-shared-app-state";
import { getOpenTasks } from "@/lib/engine";

function formatDate(value: string | null) {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function SimpleHome() {
  const { state, currentTrack, currentPhase, completeTaskById } = useSharedAppState();
  const tasks = getOpenTasks(state.tasks).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(54,225,178,0.12),transparent_30%),linear-gradient(180deg,#07131f_0%,#08131d_48%,#050b12_100%)] text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-8 sm:px-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-[0.24em] text-[var(--accent-3)]">
              <Waves className="h-3.5 w-3.5" />
              JIANGHU NIGHT RAIN
            </div>
            <h1 className="font-display text-4xl text-white sm:text-5xl">江湖夜雨十年灯</h1>
          </div>
          <Link href="/system" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">
            进入系统页
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[rgba(9,17,25,0.76)] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="mb-3 text-sm text-slate-300">当前阶段</div>
            <div className="text-3xl font-semibold text-white">{currentTrack?.name ?? "还没有主线"}</div>
            <div className="mt-3 text-lg text-[var(--accent-3)]">{currentPhase?.name ?? "去系统页创建或自动生成阶段"}</div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent-2),var(--accent-3))]" style={{ width: `${currentTrack?.overallPercent ?? 0}%` }} />
            </div>
            <div className="mt-2 text-sm text-slate-400">进度 {currentTrack?.overallPercent ?? 0}%</div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[rgba(9,17,25,0.76)] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
              <Coins className="h-4 w-4 text-[var(--accent-3)]" />
              恒力
            </div>
            <div className="text-5xl font-semibold text-white">{state.profile.coins}</div>
            <div className="mt-3 text-sm text-slate-400">完成任务和阶段后会持续获得。</div>
          </div>
        </section>

        <section className="flex-1 rounded-[2rem] border border-white/10 bg-[rgba(9,17,25,0.76)] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
          <div className="mb-5 flex items-center gap-2 text-lg text-white">
            <ListTodo className="h-5 w-5 text-[var(--accent-3)]" />
            今日任务
          </div>

          <div className="space-y-3">
            {tasks.length > 0 ? tasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-lg font-medium text-white">{task.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{task.detail}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>截止 {formatDate(task.dueAt)}</span>
                    <span>奖励 +{task.rewardCoin} 恒力</span>
                  </div>
                </div>
                <button type="button" onClick={() => completeTaskById(task.id)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110">
                  <Check className="h-4 w-4" />
                  完成
                </button>
              </div>
            )) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-slate-400">当前没有待办任务，去系统页手动添加，或者直接用 AI 自动生成。</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
