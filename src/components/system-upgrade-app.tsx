"use client";

import {
  Activity,
  BadgeCheck,
  Brain,
  Check,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  Flame,
  Gift,
  HeartPulse,
  ImagePlus,
  Plus,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Trophy,
  Upload,
  Zap,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

import {
  completeTask,
  createAttribute,
  createId,
  createInspiration,
  createPhase,
  createReward,
  createTask,
  createTrack,
  getCurrentTitle,
  getCurrentTrack,
  getLevel,
  getOpenTasks,
  getPhaseById,
  getTodayCompletions,
  normalizeState,
  redeemReward,
  setActiveTitle,
  updateAttributeValue,
  buildProfileSummary,
  DIFFICULTY_REWARDS,
} from "@/lib/engine";
import { createDefaultState } from "@/lib/default-state";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type {
  AchievementTitle,
  AppState,
  Difficulty,
  InspirationCard,
  RewardItem,
  SyncStatus,
  Task,
  TaskSettlement,
  TrackPhase,
  UserAttribute,
} from "@/lib/types";

const STORAGE_KEY = "system-upgrade-pwa-state-v1";
const inspirationBucket = process.env.NEXT_PUBLIC_SUPABASE_INSPIRATION_BUCKET;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function readLocalState() {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw) as Partial<AppState>) : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

function saveLocalState(state: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(value: string | null) {
  if (!value) {
    return "未设置";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getTitleById(titles: AchievementTitle[], titleId: string | null) {
  return titles.find((title) => title.id === titleId) ?? null;
}

function getBadgeTone(style: string) {
  switch (style) {
    case "amber":
      return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-300/30";
    case "rose":
      return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-300/30";
    case "sky":
      return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-300/30";
    case "violet":
      return "bg-violet-500/15 text-violet-200 ring-1 ring-violet-300/30";
    default:
      return "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30";
  }
}

function getTaskTone(difficulty: Difficulty) {
  switch (difficulty) {
    case "challenge":
      return "bg-rose-500/12 text-rose-100 ring-1 ring-rose-300/25";
    case "normal":
      return "bg-amber-500/12 text-amber-50 ring-1 ring-amber-300/25";
    default:
      return "bg-sky-500/12 text-sky-50 ring-1 ring-sky-300/25";
  }
}

function parseOptionalDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function getCooldownLabel(reward: RewardItem) {
  if (!reward.lastRedeemedAt || reward.cooldownDays === 0) {
    return "可立即兑换";
  }

  const nextReadyAt = new Date(reward.lastRedeemedAt);
  nextReadyAt.setDate(nextReadyAt.getDate() + reward.cooldownDays);

  if (Date.now() >= nextReadyAt.getTime()) {
    return "可立即兑换";
  }

  return `冷却到 ${new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(nextReadyAt)}`;
}

function canRedeemReward(reward: RewardItem, coins: number) {
  if (!reward.enabled || coins < reward.costCoin) {
    return false;
  }

  if (!reward.lastRedeemedAt || reward.cooldownDays === 0) {
    return true;
  }

  const nextReadyAt = new Date(reward.lastRedeemedAt);
  nextReadyAt.setDate(nextReadyAt.getDate() + reward.cooldownDays);
  return Date.now() >= nextReadyAt.getTime();
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function loadCloudState(client: NonNullable<ReturnType<typeof createBrowserSupabase>>, userId: string) {
  const snapshotClient = client.from("user_snapshots") as unknown as {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { state: AppState } | null; error: Error | null }>;
      };
    };
  };
  const result = await snapshotClient.select("state").eq("user_id", userId).maybeSingle();
  const error = result.error;
  const data = result.data as { state: AppState } | null;
  if (error) {
    throw error;
  }
  return data?.state ? normalizeState(data.state) : null;
}

async function saveCloudState(client: NonNullable<ReturnType<typeof createBrowserSupabase>>, userId: string, state: AppState) {
  const snapshotClient = client.from("user_snapshots") as unknown as {
    upsert: (
      values: { user_id: string; state: AppState },
      options: { onConflict: string },
    ) => Promise<{ error: Error | null }>;
  };
  const { error: snapshotError } = await snapshotClient.upsert({ user_id: userId, state }, { onConflict: "user_id" });
  if (snapshotError) {
    throw snapshotError;
  }

  const summary = buildProfileSummary(state, userId);
  const profileClient = client.from("user_profiles") as unknown as {
    upsert: (
      values: ReturnType<typeof buildProfileSummary>,
      options: { onConflict: string },
    ) => Promise<{ error: Error | null }>;
  };
  const { error: profileError } = await profileClient.upsert(summary, { onConflict: "user_id" });
  if (profileError) {
    throw profileError;
  }
}

async function uploadInspirationAsset(
  client: NonNullable<ReturnType<typeof createBrowserSupabase>> | null,
  user: User | null,
  file: File,
) {
  if (client && user && inspirationBucket) {
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/${Date.now()}-${slugify(file.name || "inspiration")}.${ext}`;
      const { error } = await client.storage.from(inspirationBucket).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (!error) {
        const { data } = client.storage.from(inspirationBucket).getPublicUrl(path);
        return data.publicUrl;
      }
    } catch {
      return fileToDataUrl(file);
    }
  }

  return fileToDataUrl(file);
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent-2),var(--accent-3))] transition-[width]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[rgba(6,14,22,0.74)] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-300/80">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <Icon className="h-5 w-5 text-[var(--accent-3)]" />
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function QuickMetric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-xl font-semibold text-white">{value}</span>
        <span className="pb-0.5 text-xs text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

function InstallButton({
  event,
  onInstall,
}: {
  event: BeforeInstallPromptEvent | null;
  onInstall: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onInstall}
      disabled={!event}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ShieldCheck className="h-4 w-4" />
      安装到桌面
    </button>
  );
}

function AttributeEditorCard({
  attribute,
  onSave,
}: {
  attribute: UserAttribute;
  onSave: (attributeId: string, value: number, note: string) => void;
}) {
  const [value, setValue] = useState(String(attribute.currentValue));
  const [note, setNote] = useState("手动录入");

  useEffect(() => {
    setValue(String(attribute.currentValue));
  }, [attribute.currentValue]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-300">{attribute.name}</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {attribute.currentValue}
            <span className="ml-1 text-sm text-slate-400">{attribute.unit}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">基线 {attribute.baselineValue}{attribute.unit}</div>
        </div>
        <div className="rounded-full border border-white/12 px-3 py-1 text-xs text-slate-300">{attribute.group}</div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          type="number"
          step="0.1"
          className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="更新说明"
          className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={() => onSave(attribute.id, Number(value), note || "手动更新")}
          className="rounded-2xl bg-[var(--accent-2)] px-4 py-2 text-sm font-medium text-slate-950 transition hover:brightness-110"
        >
          记录
        </button>
      </div>
    </div>
  );
}

export function SystemUpgradeApp() {
  const [state, setState] = useState<AppState>(() => createDefaultState());
  const [supabase, setSupabase] = useState<ReturnType<typeof createBrowserSupabase>>(null);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isSupabaseConfigured ? "connecting" : "demo");
  const [syncMessage, setSyncMessage] = useState("当前使用本地模式，可先体验全部功能。");
  const [email, setEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [latestSettlement, setLatestSettlement] = useState<TaskSettlement | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const hydratedRef = useRef(false);
  const skipCloudSaveRef = useRef(true);

  useEffect(() => {
    setSupabase(createBrowserSupabase());
  }, []);

  useEffect(() => {
    const local = readLocalState();
    skipCloudSaveRef.current = true;
    setState(local);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    if (!supabase) {
      setSyncStatus(isSupabaseConfigured ? "signed-out" : "demo");
      setSyncMessage(
        isSupabaseConfigured
          ? "配置了云同步，但当前未登录。先在本地体验，登录后会自动同步。"
          : "未检测到 Supabase 环境变量，当前以本地离线模式运行。",
      );
      return;
    }

    let cancelled = false;

    const boot = async () => {
      setSyncStatus("connecting");
      setSyncMessage("正在连接云端档案...");

      const { data, error } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (error) {
        setSyncStatus("error");
        setSyncMessage("云端连接失败，已回退到本地模式。");
        return;
      }

      const currentUser = data.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setSyncStatus("signed-out");
        setSyncMessage("未登录邮箱魔法链接账号，当前数据保存在本地浏览器。");
        return;
      }

      try {
        const remoteState = await loadCloudState(supabase, currentUser.id);

        if (cancelled) {
          return;
        }

        if (remoteState) {
          skipCloudSaveRef.current = true;
          setState(remoteState);
          saveLocalState(remoteState);
          setSyncMessage(`已同步云端档案: ${currentUser.email ?? "已登录账号"}`);
        } else {
          await saveCloudState(supabase, currentUser.id, state);
          setSyncMessage(`已为 ${currentUser.email ?? "当前账号"} 创建云端档案`);
        }

        setSyncStatus("ready");
      } catch {
        setSyncStatus("error");
        setSyncMessage("读取云端档案失败，暂时继续使用本地数据。");
      }
    };

    void boot();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setSyncStatus("signed-out");
        setSyncMessage("已退出云端账号，后续修改将保存在本地。");
        return;
      }

      void (async () => {
        setSyncStatus("connecting");
        try {
          const remoteState = await loadCloudState(supabase, currentUser.id);

          if (remoteState) {
            skipCloudSaveRef.current = true;
            setState(remoteState);
            saveLocalState(remoteState);
          } else {
            await saveCloudState(supabase, currentUser.id, state);
          }

          setSyncStatus("ready");
          setSyncMessage(`云端已连接: ${currentUser.email ?? "已登录账号"}`);
        } catch {
          setSyncStatus("error");
          setSyncMessage("同步状态异常，请稍后重试。");
        }
      })();
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [supabase, state]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    saveLocalState(state);

    if (skipCloudSaveRef.current) {
      skipCloudSaveRef.current = false;
      return;
    }

    if (!supabase || !user) {
      return;
    }

    setSyncStatus("saving");
    setSyncMessage("正在把最新系统面板同步到云端...");

    const timer = window.setTimeout(async () => {
      try {
        await saveCloudState(supabase, user.id, state);
        setSyncStatus("ready");
        setSyncMessage(`已同步到云端: ${user.email ?? "当前账号"}`);
      } catch {
        setSyncStatus("error");
        setSyncMessage("云端保存失败，本地数据仍然保留。");
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state, supabase, user]);

  useEffect(() => {
    if (state.inspirations.filter((item) => item.active).length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setCarouselIndex((current) => current + 1);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.inspirations]);

  useEffect(() => {
    const handler = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setInstallPrompt(installEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const currentTitle = getCurrentTitle(state);
  const currentTrack = getCurrentTrack(state);
  const currentPhase = currentTrack ? getPhaseById(state.phases, currentTrack.currentPhaseId) : null;
  const todayTasks = getOpenTasks(state.tasks).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const todaySettlements = getTodayCompletions(state);
  const featuredInspirationPool = state.inspirations.filter((item) => item.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const featuredInspiration = featuredInspirationPool[carouselIndex % Math.max(featuredInspirationPool.length, 1)] ?? null;
  const bodyMetrics = state.attributes.filter((attribute) => attribute.group === "body" && attribute.visibleOnDashboard).slice(0, 4);
  const growthMetrics = state.attributes.filter((attribute) => attribute.group === "growth" && attribute.visibleOnDashboard).slice(0, 4);
  const latestEntries = state.measurementEntries.slice(0, 6);
  const level = getLevel(state.profile.totalExp);

  const commitState = (updater: (current: AppState) => AppState) => {
    setState((current) => normalizeState(updater(current)));
  };

  const handleTaskComplete = (taskId: string) => {
    let settlement: TaskSettlement | null = null;
    commitState((current) => {
      const result = completeTask(current, taskId);
      settlement = result.settlement;
      return result.state;
    });
    setLatestSettlement(settlement);
  };

  const handleSendMagicLink = async () => {
    if (!supabase || !email) {
      return;
    }

    setAuthBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        throw error;
      }

      setSyncMessage("魔法链接已发送，请在邮箱中打开完成登录。");
      setSyncStatus("signed-out");
    } catch {
      setSyncStatus("error");
      setSyncMessage("发送魔法链接失败，请检查 Supabase 邮箱配置。");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSyncStatus("signed-out");
    setSyncMessage("已退出云端账号，后续修改将保存在本地。");
  };

  const handleInstall = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-main)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(69,255,193,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,191,71,0.12),transparent_24%),radial-gradient(circle_at_bottom,rgba(76,170,255,0.1),transparent_28%)]" />
      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(135deg,rgba(6,15,22,0.94),rgba(9,28,36,0.85))] p-6 shadow-[0_30px_100px_rgba(2,6,23,0.55)]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs tracking-[0.28em] text-[var(--accent-3)]">
              <Sparkles className="h-4 w-4" />
              江湖夜雨十年灯 / 详细页
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <InstallButton event={installPrompt} onInstall={handleInstall} />
              <div className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-slate-200">
                {syncStatus === "ready" ? "云同步已连接" : syncStatus === "saving" ? "正在同步" : syncStatus === "demo" ? "本地模式" : syncStatus}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <div>
              <div className="max-w-3xl">
                <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
                  把你的成长做成
                  <span className="bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] bg-clip-text text-transparent">
                    {" "}可视化系统面板
                  </span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  主线目标、阶段推进、身体属性、任务结算、奖励兑换和激励展示全部放进同一套成长系统里。电脑端和手机端共用一套响应式界面，登录后即可云同步。
                </p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="系统等级" value={`Lv.${level}`} hint={`总 EXP ${state.profile.totalExp} / 下一级 ${level * 100}`} icon={Zap} />
                <StatTile label="恒力" value={`${state.profile.coins}`} hint="任务、阶段完成和称号都会发放" icon={CircleDollarSign} />
                <StatTile label="当前称号" value={currentTitle?.name ?? "未命名"} hint={`连续 ${state.profile.streak} 天仍在推进`} icon={Trophy} />
                <StatTile label="今日推进" value={`${todaySettlements.length} 项`} hint={`${todayTasks.length} 个未完成任务等待结算`} icon={Swords} />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-300">当前主线</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{currentTrack?.name ?? "创建你的第一条主线"}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{currentTrack?.targetText ?? "把长期目标拆成阶段，完成任务时自动推进百分比。"}</p>
                    </div>
                    <Target className="h-10 w-10 text-[var(--accent-3)]" />
                  </div>
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                      <span>{currentPhase?.name ?? "暂无阶段"}</span>
                      <span>{currentTrack?.overallPercent ?? 0}%</span>
                    </div>
                    <ProgressBar value={currentTrack?.overallPercent ?? 0} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {bodyMetrics.slice(0, 2).map((item) => (
                      <QuickMetric key={item.id} label={item.name} value={item.currentValue} unit={item.unit} />
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,27,42,0.88),rgba(12,19,28,0.75))] p-5">
                  {featuredInspiration ? (
                    <div className="flex h-full min-h-64 flex-col justify-between gap-4">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-[var(--accent-3)]">
                        <span>激励卡片</span>
                        <span>{featuredInspiration.type === "image" ? "Image" : "Quote"}</span>
                      </div>
                      {featuredInspiration.imageUrl ? (
                        <img src={featuredInspiration.imageUrl} alt={featuredInspiration.text} className="h-40 w-full rounded-3xl object-cover" />
                      ) : (
                        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(69,255,193,0.22),transparent_48%),rgba(255,255,255,0.04)] p-6">
                          <Sparkles className="h-6 w-6 text-[var(--accent-3)]" />
                          <p className="mt-4 font-display text-2xl leading-10 text-white">{featuredInspiration.text}</p>
                        </div>
                      )}
                      <p className="text-sm leading-6 text-slate-300/90">{featuredInspiration.text}</p>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
                      添加一句你喜欢的话，或上传一张让你想继续前进的图片。
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { href: "#tasks", label: "任务面板" },
                  { href: "#tracks", label: "成长名录" },
                  { href: "#attributes", label: "属性面板" },
                  { href: "#rewards", label: "奖励系统" },
                  { href: "#inspiration", label: "激励中心" },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <SectionCard title="云同步入口" subtitle={syncMessage} actions={<Cloud className="h-5 w-5 text-[var(--accent-3)]" />}>
                <div className="grid gap-3">
                  {user ? (
                    <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/8 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm text-emerald-100">已连接账号</div>
                          <div className="mt-2 text-lg font-semibold text-white">{user.email}</div>
                          <p className="mt-2 text-sm text-slate-300">现在在电脑和手机上登录同一邮箱账号，就能共享成长系统数据。</p>
                        </div>
                        <BadgeCheck className="h-6 w-6 text-emerald-300" />
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="mt-4 rounded-full border border-white/12 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                      >
                        退出当前账号
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="输入你的邮箱，发送魔法登录链接"
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={handleSendMagicLink}
                        disabled={!supabase || !email || authBusy}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Cloud className="h-4 w-4" />
                        {authBusy ? "发送中..." : "发送邮箱魔法链接"}
                      </button>
                      {!isSupabaseConfigured ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-4 text-xs leading-6 text-slate-400">
                          还没有配置 Supabase。先在本地体验也没问题，等你补上 `.env` 后，云同步会自动接管。
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="身体属性速览" subtitle="先看身体，再看成长，系统流的基础是持续可见。">
                <div className="grid gap-3 sm:grid-cols-2">
                  {bodyMetrics.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/8 bg-white/5 p-3">
                      <div className="text-sm text-slate-300">{item.name}</div>
                      <div className="mt-2 flex items-end gap-1">
                        <span className="text-xl font-semibold text-white">{item.currentValue}</span>
                        <span className="pb-0.5 text-xs text-slate-400">{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="成长属性速览" subtitle="执行力、学习力和精神状态会决定你这台系统跑多快。">
                <div className="grid gap-3 sm:grid-cols-2">
                  {growthMetrics.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/8 bg-white/5 p-3">
                      <div className="text-sm text-slate-300">{item.name}</div>
                      <div className="mt-2 flex items-end gap-1">
                        <span className="text-xl font-semibold text-white">{item.currentValue}</span>
                        <span className="pb-0.5 text-xs text-slate-400">{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        </section>

        <div id="tasks" className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title="任务面板" subtitle="完成任务后，会统一结算 EXP、恒力、属性加成和阶段推进。" actions={<Activity className="h-5 w-5 text-[var(--accent-3)]" />}>
            <TaskComposer
              state={state}
              onCreate={(task) =>
                commitState((current) => ({
                  ...current,
                  tasks: [task, ...current.tasks],
                }))
              }
            />

            <div className="mt-5 grid gap-3">
              {todayTasks.length > 0 ? (
                todayTasks.map((task) => {
                  const phase = getPhaseById(state.phases, task.linkedPhaseId);
                  return (
                    <div key={task.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">{task.title}</h3>
                            <span className={cn("rounded-full px-3 py-1 text-xs", getTaskTone(task.difficulty))}>{task.difficulty}</span>
                            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                              {task.recurrence === "none" ? "一次性" : task.recurrence === "daily" ? "每日" : "每周"}
                            </span>
                          </div>
                          <p className="text-sm leading-6 text-slate-300">{task.detail}</p>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                            <span>截止 {formatDate(task.dueAt)}</span>
                            <span>奖励 {task.rewardExp} EXP / {task.rewardCoin} 恒力</span>
                            {phase ? <span>推进 {phase.name} +{task.progressDelta}%</span> : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTaskComplete(task.id)}
                            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                          >
                            <Check className="h-4 w-4" />
                            完成结算
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              commitState((current) => ({
                                ...current,
                                tasks: current.tasks.filter((item) => item.id !== task.id),
                              }))
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-slate-400">
                  今天的待办已经清空，或者你还没添加任务。给自己安排一个能立刻开始的小动作吧。
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="系统总览" subtitle="把身体、主线、奖励和称号放到同一张看板里。" actions={<HeartPulse className="h-5 w-5 text-[var(--accent-3)]" />}>
            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                  <span>主线推进</span>
                  <span>{currentTrack?.overallPercent ?? 0}%</span>
                </div>
                <ProgressBar value={currentTrack?.overallPercent ?? 0} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-slate-300">连续推进</div>
                  <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
                    <Flame className="h-6 w-6 text-orange-300" />
                    {state.profile.streak} 天
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-slate-300">累计完成任务</div>
                  <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
                    <BadgeCheck className="h-6 w-6 text-emerald-300" />
                    {state.profile.completedTaskCount} 项
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                  <Brain className="h-4 w-4 text-[var(--accent-3)]" />
                  最近属性录入
                </div>
                <div className="space-y-2">
                  {latestEntries.map((entry) => {
                    const attribute = state.attributes.find((item) => item.id === entry.attributeId);
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-sm">
                        <div>
                          <div className="text-white">{attribute?.name ?? "未知属性"}</div>
                          <div className="text-xs text-slate-400">{entry.note}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white">
                            {entry.value}
                            <span className="ml-1 text-xs text-slate-400">{attribute?.unit}</span>
                          </div>
                          <div className="text-xs text-slate-500">{formatDate(entry.recordedAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div id="tracks">
          <SectionCard title="成长名录与阶段" subtitle="每条主线都可以自己添加阶段、手动调整百分比，或者让任务完成时自动推进。" actions={<Target className="h-5 w-5 text-[var(--accent-3)]" />}>
            <TrackComposer
              onCreate={(track, phase) =>
                commitState((current) => ({
                  ...current,
                  tracks: [track, ...current.tracks],
                  phases: [phase, ...current.phases],
                }))
              }
            />

            <div className="mt-5 grid gap-4">
              {state.tracks.map((track) => {
                const ownPhases = state.phases.filter((phase) => phase.trackId === track.id).sort((a, b) => a.orderIndex - b.orderIndex);
                return (
                  <div key={track.id} className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
                    <div className="mb-3 grid gap-3 sm:grid-cols-2">
                      <input
                        value={track.name}
                        onChange={(event) =>
                          commitState((current) => ({
                            ...current,
                            tracks: current.tracks.map((item) => (item.id === track.id ? { ...item, name: event.target.value } : item)),
                          }))
                        }
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                      />
                      <input
                        value={track.category}
                        onChange={(event) =>
                          commitState((current) => ({
                            ...current,
                            tracks: current.tracks.map((item) => (item.id === track.id ? { ...item, category: event.target.value } : item)),
                          }))
                        }
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                      />
                    </div>
                    <textarea
                      value={track.targetText}
                      onChange={(event) =>
                        commitState((current) => ({
                          ...current,
                          tracks: current.tracks.map((item) => (item.id === track.id ? { ...item, targetText: event.target.value } : item)),
                        }))
                      }
                      rows={2}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    />
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <select
                        value={track.progressMode}
                        onChange={(event) =>
                          commitState((current) => ({
                            ...current,
                            tracks: current.tracks.map((item) =>
                              item.id === track.id ? { ...item, progressMode: event.target.value as AppState["tracks"][number]["progressMode"] } : item,
                            ),
                          }))
                        }
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="manual">手动推进</option>
                        <option value="task-linked">任务联动</option>
                      </select>
                      <select
                        value={track.status}
                        onChange={(event) =>
                          commitState((current) => ({
                            ...current,
                            tracks: current.tracks.map((item) =>
                              item.id === track.id ? { ...item, status: event.target.value as AppState["tracks"][number]["status"] } : item,
                            ),
                          }))
                        }
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="active">进行中</option>
                        <option value="paused">暂停</option>
                        <option value="completed">已完成</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          commitState((current) => ({
                            ...current,
                            tracks: current.tracks.filter((item) => item.id !== track.id),
                            phases: current.phases.filter((phase) => phase.trackId !== track.id),
                            tasks: current.tasks.map((task) => (task.linkedTrackId === track.id ? { ...task, linkedTrackId: null, linkedPhaseId: null, progressDelta: 0 } : task)),
                          }))
                        }
                        className="rounded-2xl border border-rose-300/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-500/15"
                      >
                        删除主线
                      </button>
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                        <span>总进度</span>
                        <span>{track.overallPercent}%</span>
                      </div>
                      <ProgressBar value={track.overallPercent} />
                    </div>

                    <div className="mt-4 space-y-3">
                      {ownPhases.map((phase) => (
                        <div key={phase.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_0.8fr_auto]">
                            <input
                              value={phase.name}
                              onChange={(event) =>
                                commitState((current) => ({
                                  ...current,
                                  phases: current.phases.map((item) => (item.id === phase.id ? { ...item, name: event.target.value } : item)),
                                }))
                              }
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                            />
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>阶段进度</span>
                                <span>{phase.percent}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={phase.percent}
                                onChange={(event) =>
                                  commitState((current) => ({
                                    ...current,
                                    phases: current.phases.map((item) => (item.id === phase.id ? { ...item, percent: Number(event.target.value) } : item)),
                                  }))
                                }
                                className="w-full accent-[var(--accent-2)]"
                              />
                            </div>
                            <input
                              type="number"
                              value={phase.rewardCoin}
                              onChange={(event) =>
                                commitState((current) => ({
                                  ...current,
                                  phases: current.phases.map((item) => (item.id === phase.id ? { ...item, rewardCoin: Number(event.target.value) } : item)),
                                }))
                              }
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                commitState((current) => ({
                                  ...current,
                                  phases: current.phases.filter((item) => item.id !== phase.id).map((item) => (item.trackId === track.id && item.orderIndex > phase.orderIndex ? { ...item, orderIndex: item.orderIndex - 1 } : item)),
                                  tasks: current.tasks.map((task) => (task.linkedPhaseId === phase.id ? { ...task, linkedPhaseId: null, progressDelta: 0 } : task)),
                                }))
                              }
                              className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                            >
                              删除阶段
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                            <input
                              value={phase.rewardText}
                              onChange={(event) =>
                                commitState((current) => ({
                                  ...current,
                                  phases: current.phases.map((item) => (item.id === phase.id ? { ...item, rewardText: event.target.value } : item)),
                                }))
                              }
                              placeholder="阶段奖励描述"
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                            />
                            <select
                              value={phase.rewardTitleId ?? ""}
                              onChange={(event) =>
                                commitState((current) => ({
                                  ...current,
                                  phases: current.phases.map((item) => (item.id === phase.id ? { ...item, rewardTitleId: event.target.value || null } : item)),
                                }))
                              }
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                            >
                              <option value="">阶段不解锁称号</option>
                              {state.titles.map((title) => (
                                <option key={title.id} value={title.id}>{title.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          commitState((current) => ({
                            ...current,
                            phases: [...current.phases, createPhase(track.id, `新阶段 ${ownPhases.length + 1}`, ownPhases.length + 1)],
                          }))
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                      >
                        <Plus className="h-4 w-4" />
                        添加阶段
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <div id="attributes">
          <SectionCard title="属性面板" subtitle="身体属性、成长属性和自定义属性全部统一维护，录入后会自动写入测量历史。" actions={<Brain className="h-5 w-5 text-[var(--accent-3)]" />}>
            <AttributeComposer
              onCreate={(attribute) =>
                commitState((current) => ({
                  ...current,
                  attributes: [attribute, ...current.attributes],
                  measurementEntries: [
                    {
                      id: createId("measurement"),
                      attributeId: attribute.id,
                      value: attribute.currentValue,
                      note: "自定义属性初始化",
                      recordedAt: new Date().toISOString(),
                    },
                    ...current.measurementEntries,
                  ],
                }))
              }
            />

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              {(["body", "growth", "custom"] as const).map((group) => (
                <div key={group} className="space-y-3">
                  <div className="mb-2 flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-slate-400">
                    {group === "body" ? <HeartPulse className="h-4 w-4" /> : group === "growth" ? <Zap className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    {group}
                  </div>
                  {state.attributes.filter((attribute) => attribute.group === group).map((attribute) => (
                    <AttributeEditorCard
                      key={attribute.id}
                      attribute={attribute}
                      onSave={(attributeId, value, note) => commitState((current) => updateAttributeValue(current, attributeId, value, note))}
                    />
                  ))}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <div id="rewards">
            <SectionCard title="奖励系统与称号" subtitle="恒力可以兑换现实奖励，也可以用称号切换当前成长身份。" actions={<Gift className="h-5 w-5 text-[var(--accent-3)]" />}>
              <RewardComposer
                onCreate={(reward) =>
                  commitState((current) => ({
                    ...current,
                    rewards: [reward, ...current.rewards],
                  }))
                }
              />

              <div className="mt-5 space-y-3">
                {state.rewards.map((reward) => (
                  <div key={reward.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{reward.title}</h3>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{reward.costCoin} 恒力</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{reward.description}</p>
                        <p className="mt-2 text-xs text-slate-500">{getCooldownLabel(reward)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => commitState((current) => redeemReward(current, reward.id))}
                          disabled={!canRedeemReward(reward, state.profile.coins)}
                          className="rounded-full bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          兑换奖励
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitState((current) => ({
                              ...current,
                              rewards: current.rewards.filter((item) => item.id !== reward.id),
                            }))
                          }
                          className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
                  <Trophy className="h-4 w-4 text-[var(--accent-3)]" />
                  已解锁称号
                </div>
                <div className="flex flex-wrap gap-3">
                  {state.titles.map((title) => (
                    <button
                      key={title.id}
                      type="button"
                      disabled={!title.unlocked}
                      onClick={() => commitState((current) => setActiveTitle(current, title.id))}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm transition",
                        getBadgeTone(title.badgeStyle),
                        title.active ? "shadow-[0_0_0_1px_rgba(255,255,255,0.3)]" : "",
                        !title.unlocked ? "cursor-not-allowed opacity-35" : "hover:brightness-110",
                      )}
                    >
                      {title.name}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          <div id="inspiration">
            <SectionCard title="激励中心" subtitle="可以添加名言，也可以上传自己的图片，把你真正有感觉的东西挂在系统里。" actions={<ImagePlus className="h-5 w-5 text-[var(--accent-3)]" />}>
              <InspirationComposer
                client={supabase}
                user={user}
                onCreate={(card) =>
                  commitState((current) => ({
                    ...current,
                    inspirations: [...current.inspirations, card]
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((item, index) => ({ ...item, sortOrder: index + 1 })),
                  }))
                }
              />

              <div className="mt-5 grid gap-3">
                {state.inspirations.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                  <div key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{item.type === "image" ? "图片激励" : "名言激励"}</span>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">#{item.sortOrder}</span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-200">{item.text}</p>
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.text} className="mt-4 h-40 w-full rounded-3xl object-cover" /> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            commitState((current) => ({
                              ...current,
                              inspirations: current.inspirations.map((card) => (card.id === item.id ? { ...card, active: !card.active } : card)),
                            }))
                          }
                          className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                          {item.active ? "停用" : "启用"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitState((current) => ({
                              ...current,
                              inspirations: current.inspirations.filter((card) => card.id !== item.id).map((card, index) => ({ ...card, sortOrder: index + 1 })),
                            }))
                          }
                          className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="部署与同步提示" subtitle="这套 PWA 支持先本地跑，再切到正式云同步。" actions={<Cloud className="h-5 w-5 text-[var(--accent-3)]" />}>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-slate-300">本地体验</div>
              <p className="mt-3 text-sm leading-7 text-slate-400">不配 Supabase 也能完整体验任务、主线、属性、奖励和激励功能，数据保存在本地浏览器。</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-slate-300">云同步上线</div>
              <p className="mt-3 text-sm leading-7 text-slate-400">配好 `.env` 后，邮箱魔法链接登录即可在电脑和手机之间共享状态，适合部署到 Vercel。</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-slate-300">PWA 安装</div>
              <p className="mt-3 text-sm leading-7 text-slate-400">浏览器会缓存最近访问的首页和基础资源，手机和桌面都可以安装成接近原生应用的入口。</p>
            </div>
          </div>
        </SectionCard>
      </main>

      {latestSettlement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(8,18,28,0.98),rgba(8,13,20,0.98))] p-6 shadow-[0_30px_120px_rgba(2,6,23,0.8)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-[var(--accent-3)]">Task Settlement</div>
                <h3 className="mt-2 font-display text-3xl text-white">任务结算完成</h3>
              </div>
              <button type="button" onClick={() => setLatestSettlement(null)} className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">
                关闭
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-emerald-300/15 bg-emerald-500/8 p-4">
                <div className="text-sm text-emerald-100">获得 EXP</div>
                <div className="mt-2 text-3xl font-semibold text-white">+{latestSettlement.earnedExp}</div>
              </div>
              <div className="rounded-3xl border border-amber-300/15 bg-amber-500/8 p-4">
                <div className="text-sm text-amber-100">获得恒力</div>
                <div className="mt-2 text-3xl font-semibold text-white">+{latestSettlement.earnedCoin}</div>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-200">
              {latestSettlement.appliedProgress.length > 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 text-slate-300">阶段推进</div>
                  {latestSettlement.appliedProgress.map((progress) => (
                    <div key={progress.phaseId} className="flex items-center justify-between">
                      <span>阶段进度 +{progress.delta}%</span>
                      <span className="text-[var(--accent-3)]">{progress.newPercent}%</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {latestSettlement.appliedAttributes.length > 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 text-slate-300">属性增益</div>
                  {latestSettlement.appliedAttributes.map((effect) => {
                    const attribute = state.attributes.find((item) => item.id === effect.attributeId);
                    return (
                      <div key={`${effect.attributeId}-${effect.delta}`} className="flex items-center justify-between">
                        <span>{attribute?.name ?? effect.attributeId}</span>
                        <span className="text-[var(--accent-3)]">+{effect.delta}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {latestSettlement.unlockedTitles.length > 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 text-slate-300">新解锁称号</div>
                  <div className="flex flex-wrap gap-2">
                    {latestSettlement.unlockedTitles.map((titleId) => {
                      const title = getTitleById(state.titles, titleId);
                      return title ? (
                        <span key={title.id} className={cn("rounded-full px-3 py-1 text-sm", getBadgeTone(title.badgeStyle))}>{title.name}</span>
                      ) : null;
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskComposer({ state, onCreate }: { state: AppState; onCreate: (task: Task) => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [dueAt, setDueAt] = useState("");
  const [recurrence, setRecurrence] = useState<Task["recurrence"]>("daily");
  const [linkedTrackId, setLinkedTrackId] = useState("");
  const [linkedPhaseId, setLinkedPhaseId] = useState("");
  const [progressDelta, setProgressDelta] = useState(10);
  const [linkedAttributeId, setLinkedAttributeId] = useState("");
  const [attributeDelta, setAttributeDelta] = useState(1);

  const linkedTrackPhases = state.phases.filter((phase) => phase.trackId === linkedTrackId).sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <Plus className="h-4 w-4 text-[var(--accent-3)]" />
        新增任务
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="任务标题" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="任务说明" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none">
          <option value="easy">简单</option>
          <option value="normal">普通</option>
          <option value="challenge">挑战</option>
        </select>
        <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
        <select value={recurrence} onChange={(event) => setRecurrence(event.target.value as Task["recurrence"])} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none">
          <option value="none">一次性</option>
          <option value="daily">每日</option>
          <option value="weekly">每周</option>
        </select>
        <select value={linkedTrackId} onChange={(event) => { setLinkedTrackId(event.target.value); setLinkedPhaseId(""); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none">
          <option value="">不关联主线</option>
          {state.tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
        </select>
        <select value={linkedPhaseId} onChange={(event) => setLinkedPhaseId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none">
          <option value="">不关联阶段</option>
          {linkedTrackPhases.map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}
        </select>
        <input type="number" value={progressDelta} min="0" max="100" onChange={(event) => setProgressDelta(Number(event.target.value))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
        <select value={linkedAttributeId} onChange={(event) => setLinkedAttributeId(event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none">
          <option value="">不关联属性增益</option>
          {state.attributes.map((attribute) => <option key={attribute.id} value={attribute.id}>{attribute.name}</option>)}
        </select>
        <input type="number" step="0.1" value={attributeDelta} onChange={(event) => setAttributeDelta(Number(event.target.value))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-400">默认奖励: {DIFFICULTY_REWARDS[difficulty].exp} EXP / {DIFFICULTY_REWARDS[difficulty].coin} 恒力</div>
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return;
            onCreate(createTask({
              title: title.trim(),
              detail: detail.trim(),
              difficulty,
              dueAt: parseOptionalDate(dueAt),
              recurrence,
              linkedTrackId: linkedTrackId || null,
              linkedPhaseId: linkedPhaseId || null,
              progressDelta,
              attributeEffects: linkedAttributeId ? [{ attributeId: linkedAttributeId, delta: attributeDelta }] : [],
            }));
            setTitle("");
            setDetail("");
            setDueAt("");
            setLinkedTrackId("");
            setLinkedPhaseId("");
            setLinkedAttributeId("");
            setProgressDelta(10);
            setAttributeDelta(1);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
        >
          <ChevronRight className="h-4 w-4" />
          写入任务系统
        </button>
      </div>
    </div>
  );
}

function TrackComposer({ onCreate }: { onCreate: (track: AppState["tracks"][number], phase: TrackPhase) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("成长");
  const [targetText, setTargetText] = useState("");
  const [phaseName, setPhaseName] = useState("起始阶段");
  const [mode, setMode] = useState<AppState["tracks"][number]["progressMode"]>("task-linked");

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <Plus className="h-4 w-4 text-[var(--accent-3)]" />
        新增成长主线
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="主线名称" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="分类" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <textarea value={targetText} onChange={(event) => setTargetText(event.target.value)} rows={3} placeholder="这条主线的目标说明" className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <input value={phaseName} onChange={(event) => setPhaseName(event.target.value)} placeholder="首个阶段名称" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <select value={mode} onChange={(event) => setMode(event.target.value as AppState["tracks"][number]["progressMode"])} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none">
          <option value="task-linked">任务联动</option>
          <option value="manual">手动推进</option>
        </select>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return;
            const track = createTrack(name.trim(), category.trim() || "成长", targetText.trim(), mode);
            const phase = createPhase(track.id, phaseName.trim() || "起始阶段", 1);
            onCreate(track, phase);
            setName("");
            setTargetText("");
          }}
          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
        >
          <ChevronRight className="h-4 w-4" />
          建立主线
        </button>
      </div>
    </div>
  );
}

function AttributeComposer({ onCreate }: { onCreate: (attribute: UserAttribute) => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("分");
  const [baseline, setBaseline] = useState(50);

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <Plus className="h-4 w-4 text-[var(--accent-3)]" />
        新增自定义属性
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="属性名称" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="单位" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <input type="number" value={baseline} onChange={(event) => setBaseline(Number(event.target.value))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return;
            onCreate(createAttribute(name.trim(), unit.trim() || "分", baseline));
            setName("");
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-white transition hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
          添加属性
        </button>
      </div>
    </div>
  );
}

function RewardComposer({ onCreate }: { onCreate: (reward: RewardItem) => void }) {
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState(50);
  const [description, setDescription] = useState("");
  const [cooldown, setCooldown] = useState(1);

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <Gift className="h-4 w-4 text-[var(--accent-3)]" />
        自定义兑换奖励
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="奖励名称" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <input type="number" value={cost} onChange={(event) => setCost(Number(event.target.value))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="奖励说明" className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
        <input type="number" value={cooldown} onChange={(event) => setCooldown(Number(event.target.value))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return;
            onCreate(createReward(title.trim(), cost, description.trim(), cooldown));
            setTitle("");
            setDescription("");
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-white transition hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
          添加奖励
        </button>
      </div>
    </div>
  );
}

function InspirationComposer({
  client,
  user,
  onCreate,
}: {
  client: ReturnType<typeof createBrowserSupabase>;
  user: User | null;
  onCreate: (card: InspirationCard) => void;
}) {
  const [type, setType] = useState<InspirationCard["type"]>("quote");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <ImagePlus className="h-4 w-4 text-[var(--accent-3)]" />
        新增激励卡片
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <select value={type} onChange={(event) => setType(event.target.value as InspirationCard["type"])} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none">
          <option value="quote">名言卡</option>
          <option value="image">图片卡</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <Upload className="h-4 w-4" />
          <span>{file ? file.name : "上传图片（可选）"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="写下你的名言、提醒，或者这张图想代表什么" className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={busy || (!text.trim() && !file)}
          onClick={async () => {
            setBusy(true);
            try {
              const imageUrl = file ? await uploadInspirationAsset(client, user, file) : null;
              onCreate(createInspiration(type, text.trim() || file?.name || "新的激励卡", imageUrl, Date.now()));
              setText("");
              setFile(null);
              setType("quote");
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
          {busy ? "写入中..." : "加入激励中心"}
        </button>
      </div>
    </div>
  );
}
