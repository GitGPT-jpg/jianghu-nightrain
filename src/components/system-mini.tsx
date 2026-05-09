"use client";

import Link from "next/link";
import { ArrowLeft, Check, Cloud, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";

import { useSharedAppState } from "@/hooks/use-shared-app-state";
import { applyGoalPlanToState, type GoalPlanResult } from "@/lib/goal-plan";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentTitle, getLevel, getOpenTasks } from "@/lib/engine";

function label(status: ReturnType<typeof useSharedAppState>["syncStatus"]) {
  switch (status) {
    case "demo":
      return "本地演示";
    case "connecting":
      return "正在连接";
    case "signed-out":
      return "未登录";
    case "ready":
      return "已同步";
    case "saving":
      return "保存中";
    case "error":
      return "同步异常";
    default:
      return "本地演示";
  }
}

function formatDate(value: string | null) {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function SystemMini() {
  const { state, user, syncStatus, commitState, completeTaskById, currentTrack, currentPhase } = useSharedAppState();
  const [client] = useState(() => createBrowserSupabase());
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reward, setReward] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const tasks = getOpenTasks(state.tasks).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const title = getCurrentTitle(state);

  async function sendMagicLink() {
    if (!client || !email.trim()) return;
    const result = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setAuthMessage(result.error ? result.error.message : "登录链接已发送，请去邮箱里打开。");
  }

  async function generatePlan() {
    if (!goal.trim() || !deadline.trim()) {
      setMessage("请先填写目标和完成时间。");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/goal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, deadline, reward }),
      });
      const data = (await response.json()) as { error?: string; plan?: GoalPlanResult };
      if (!response.ok || !data.plan) throw new Error(data.error ?? "生成失败");
      commitState((current) => applyGoalPlanToState(current, { goal, deadline, reward }, data.plan as GoalPlanResult));
      setMessage(`已生成 ${data.plan.phases.length} 个阶段与 ${data.plan.longTasks.length + data.plan.smallTasks.length} 个任务。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(54,225,178,0.12),transparent_30%),linear-gradient(180deg,#06101b_0%,#08121d_48%,#040a11_100%)] text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="rounded-[2rem] border border-white/10 bg-[rgba(8,15,24,0.82)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-[0.22em] text-[var(--accent-3)]">
                <Sparkles className="h-3.5 w-3.5" />
                SYSTEM
              </div>
              <h1 className="mt-4 font-display text-4xl text-white">江湖夜雨十年灯</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">这里保留完整控制面板，并新增了 AI 自动拆解目标的能力。</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                <Cloud className="mr-2 inline-block h-4 w-4" />
                {label(syncStatus)}
              </span>
              <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-sm text-slate-300">等级</div><div className="mt-2 text-3xl font-semibold text-white">Lv.{getLevel(state.profile.totalExp)}</div></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-sm text-slate-300">恒力</div><div className="mt-2 text-3xl font-semibold text-white">{state.profile.coins}</div></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-sm text-slate-300">当前阶段</div><div className="mt-2 text-xl font-semibold text-white">{currentPhase?.name ?? "未设置"}</div><div className="mt-1 text-sm text-slate-400">{currentTrack?.name ?? "暂无主线"}</div></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-sm text-slate-300">当前称号</div><div className="mt-2 text-xl font-semibold text-white">{title?.name ?? "未解锁"}</div></div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.8rem] border border-white/10 bg-[rgba(8,15,24,0.82)] p-5">
            <h2 className="font-display text-2xl text-white">AI 目标规划</h2>
            <p className="mt-1 text-sm text-slate-400">输入目标、完成时间和奖励，系统会自动生成阶段、长期任务和小任务。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={4} placeholder="例如：90 天内完成减脂 10 斤并养成稳定运动习惯" className="md:col-span-2 rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              <input value={reward} onChange={(event) => setReward(event.target.value)} placeholder="完成后的奖励" className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-400">服务端请配置 `OPENAI_API_KEY`，可选配置 `OPENAI_BASE_URL` 和 `OPENAI_MODEL`。</div>
              <button type="button" onClick={generatePlan} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                生成并写入系统
              </button>
            </div>
            {message ? <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">{message}</div> : null}
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-[rgba(8,15,24,0.82)] p-5">
            <h2 className="font-display text-2xl text-white">账号同步</h2>
            <p className="mt-1 text-sm text-slate-400">{isSupabaseConfigured ? user?.email ?? "已配置 Supabase，登录后即可多端同步。" : "当前还是本地模式，配置 Supabase 后才能自动同步。"}</p>
            {isSupabaseConfigured ? (
              <div className="mt-4 grid gap-3">
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="输入邮箱发送登录链接" className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                <button type="button" onClick={sendMagicLink} className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10">发送登录链接</button>
                {authMessage ? <div className="text-sm text-slate-400">{authMessage}</div> : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[1.8rem] border border-white/10 bg-[rgba(8,15,24,0.82)] p-5">
            <h2 className="font-display text-2xl text-white">阶段面板</h2>
            <div className="mt-4 space-y-4">
              {state.tracks.map((track) => (
                <div key={track.id} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <div className="text-lg font-semibold text-white">{track.name}</div>
                  <div className="mt-1 text-sm text-slate-400">{track.targetText}</div>
                  <div className="mt-3 space-y-2">
                    {state.phases.filter((phase) => phase.trackId === track.id).sort((a, b) => a.orderIndex - b.orderIndex).map((phase) => (
                      <div key={phase.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                        <div>
                          <div className="text-sm text-white">{phase.name}</div>
                          <div className="text-xs text-slate-500">{phase.rewardText}</div>
                        </div>
                        <input type="number" min="0" max="100" value={phase.percent} onChange={(event) => commitState((current) => ({ ...current, phases: current.phases.map((item) => item.id === phase.id ? { ...item, percent: Math.max(0, Math.min(100, Number(event.target.value))) } : item) }))} className="w-24 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/10 bg-[rgba(8,15,24,0.82)] p-5">
            <h2 className="font-display text-2xl text-white">任务</h2>
            <div className="mt-4 space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-medium text-white">{task.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{task.detail}</div>
                      <div className="mt-2 text-xs text-slate-500">截止 {formatDate(task.dueAt)} · +{task.rewardCoin} 恒力</div>
                    </div>
                    <button type="button" onClick={() => completeTaskById(task.id)} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110">
                      <Check className="h-4 w-4" />
                      完成
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
