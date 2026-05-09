import {
  createPhase,
  createReward,
  createTask,
  createTrack,
} from "@/lib/engine";
import type { AppState, Difficulty, Recurrence } from "@/lib/types";

export interface GoalPlanInput {
  goal: string;
  deadline: string;
  reward: string;
}

export interface GoalPlanPhase {
  name: string;
  description: string;
  rewardText: string;
  rewardCoin?: number;
}

export interface GoalPlanTask {
  title: string;
  detail: string;
  difficulty: Difficulty;
  recurrence: Recurrence;
  phaseIndex: number;
  progressDelta: number;
  dueOffsetDays: number;
}

export interface GoalPlanResult {
  goalName: string;
  category: string;
  summary: string;
  currentPhaseIndex: number;
  currentPhasePercent: number;
  phases: GoalPlanPhase[];
  longTasks: GoalPlanTask[];
  smallTasks: GoalPlanTask[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toSafeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toDifficulty(value: unknown, fallback: Difficulty): Difficulty {
  return value === "easy" || value === "normal" || value === "challenge" ? value : fallback;
}

function toRecurrence(value: unknown, fallback: Recurrence): Recurrence {
  return value === "none" || value === "daily" || value === "weekly" ? value : fallback;
}

function normalizeTaskList(value: unknown, fallbackDifficulty: Difficulty, fallbackRecurrence: Recurrence) {
  if (!Array.isArray(value)) {
    return [] as GoalPlanTask[];
  }

  return value
    .map((item, index) => {
      const current = item as Partial<GoalPlanTask> | null;

      return {
        title: toSafeString(current?.title, `任务 ${index + 1}`),
        detail: toSafeString(current?.detail, "按照阶段持续推进。"),
        difficulty: toDifficulty(current?.difficulty, fallbackDifficulty),
        recurrence: toRecurrence(current?.recurrence, fallbackRecurrence),
        phaseIndex: clamp(Number(current?.phaseIndex ?? 0), 0, 9),
        progressDelta: clamp(Number(current?.progressDelta ?? 8), 1, 40),
        dueOffsetDays: clamp(Number(current?.dueOffsetDays ?? index), 0, 365),
      } satisfies GoalPlanTask;
    })
    .filter((task) => task.title.length > 0);
}

export function sanitizeGoalPlan(value: unknown, fallbackGoal: string): GoalPlanResult {
  const raw = (value ?? {}) as Partial<GoalPlanResult>;
  const goalName = toSafeString(raw.goalName, fallbackGoal);
  const category = toSafeString(raw.category, "AI 规划");
  const summary = toSafeString(raw.summary, `${goalName} 的分阶段行动计划`);

  const phases =
    Array.isArray(raw.phases) && raw.phases.length > 0
      ? raw.phases.slice(0, 5).map((phase, index) => {
          const current = phase as Partial<GoalPlanPhase> | null;
          return {
            name: toSafeString(current?.name, `第 ${index + 1} 阶段`),
            description: toSafeString(current?.description, "聚焦核心推进动作。"),
            rewardText: toSafeString(current?.rewardText, "完成本阶段后领取奖励。"),
            rewardCoin: clamp(Number(current?.rewardCoin ?? 100 + index * 20), 20, 500),
          } satisfies GoalPlanPhase;
        })
      : [
          {
            name: "起步阶段",
            description: "先建立基本节奏和执行框架。",
            rewardText: "完成起步阶段后给自己一个小奖励。",
            rewardCoin: 100,
          },
          {
            name: "推进阶段",
            description: "把关键动作转成稳定输出。",
            rewardText: "完成推进阶段后巩固成果。",
            rewardCoin: 120,
          },
          {
            name: "冲刺阶段",
            description: "围绕最终目标集中完成收尾。",
            rewardText: "完成冲刺阶段后领取最终奖励。",
            rewardCoin: 160,
          },
        ];

  const maxPhaseIndex = phases.length - 1;

  return {
    goalName,
    category,
    summary,
    currentPhaseIndex: clamp(Number(raw.currentPhaseIndex ?? 0), 0, maxPhaseIndex),
    currentPhasePercent: clamp(Number(raw.currentPhasePercent ?? 10), 0, 100),
    phases,
    longTasks: normalizeTaskList(raw.longTasks, "challenge", "weekly").map((task) => ({
      ...task,
      phaseIndex: clamp(task.phaseIndex, 0, maxPhaseIndex),
    })),
    smallTasks: normalizeTaskList(raw.smallTasks, "easy", "daily").map((task) => ({
      ...task,
      phaseIndex: clamp(task.phaseIndex, 0, maxPhaseIndex),
    })),
  };
}

function buildDueAt(deadline: string, offsetDays: number) {
  const start = new Date();
  start.setHours(21, 0, 0, 0);

  const deadlineDate = new Date(deadline);
  const dueAt = new Date(start);
  dueAt.setDate(start.getDate() + offsetDays);

  if (!Number.isNaN(deadlineDate.getTime()) && dueAt.getTime() > deadlineDate.getTime()) {
    deadlineDate.setHours(21, 0, 0, 0);
    return deadlineDate.toISOString();
  }

  return dueAt.toISOString();
}

function roundRewardCost(value: number) {
  return Math.max(30, Math.ceil(value / 10) * 10);
}

export function applyGoalPlanToState(state: AppState, input: GoalPlanInput, plan: GoalPlanResult) {
  const normalized = sanitizeGoalPlan(plan, input.goal);
  const track = createTrack(
    normalized.goalName,
    normalized.category,
    `${normalized.summary}\n完成时间：${input.deadline}\n完成奖励：${input.reward}`,
    "task-linked",
  );

  const phases = normalized.phases.map((phase, index) => {
    const created = createPhase(track.id, phase.name, index + 1);
    const percent =
      index < normalized.currentPhaseIndex
        ? 100
        : index === normalized.currentPhaseIndex
          ? normalized.currentPhasePercent
          : 0;

    return {
      ...created,
      percent,
      rewardCoin: phase.rewardCoin ?? created.rewardCoin,
      rewardText:
        phase.rewardText ||
        phase.description ||
        (index === normalized.phases.length - 1 ? `完成目标后获得：${input.reward}` : "完成本阶段后领取奖励。"),
    };
  });

  const phaseIds = phases.map((phase) => phase.id);
  const plannedTasks = [...normalized.longTasks, ...normalized.smallTasks].map((task) => {
    const phaseId = phaseIds[task.phaseIndex] ?? phaseIds[0] ?? null;

    return createTask({
      title: task.title,
      detail: task.detail,
      difficulty: task.difficulty,
      dueAt: buildDueAt(input.deadline, task.dueOffsetDays),
      recurrence: task.recurrence,
      linkedTrackId: track.id,
      linkedPhaseId: phaseId,
      progressDelta: task.progressDelta,
      attributeEffects: [],
    });
  });

  const totalCoinBudget = plannedTasks.reduce((sum, task) => sum + task.rewardCoin, 0);
  const rewardTitle = input.reward.trim();
  const finalReward =
    rewardTitle.length > 0
      ? createReward(
          rewardTitle,
          roundRewardCost(totalCoinBudget || 100),
          `完成目标“${normalized.goalName}”后为自己准备的奖励。`,
          0,
        )
      : null;

  return {
    ...state,
    tracks: [track, ...state.tracks],
    phases: [...state.phases, ...phases],
    tasks: [...plannedTasks, ...state.tasks],
    rewards: finalReward ? [finalReward, ...state.rewards] : state.rewards,
  };
}
