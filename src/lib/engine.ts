import { createDefaultState } from "@/lib/default-state";
import type {
  AchievementTitle,
  AppState,
  AttributeEffect,
  Difficulty,
  GrowthTrack,
  InspirationCard,
  MeasurementEntry,
  PlayerProfile,
  ProfileSummaryRow,
  Recurrence,
  RewardItem,
  Task,
  TaskSettlement,
  TrackPhase,
  UserAttribute,
} from "@/lib/types";

export const DEFAULT_PHASE_REWARD = 100;

export const DIFFICULTY_REWARDS: Record<Difficulty, { exp: number; coin: number }> = {
  easy: { exp: 10, coin: 5 },
  normal: { exp: 25, coin: 10 },
  challenge: { exp: 50, coin: 20 },
};

function clampPercent(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundNumber(value: number) {
  return Number(value.toFixed(2));
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string | null, days: number) {
  const date = isoDate ? new Date(isoDate) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function phaseSorter(a: TrackPhase, b: TrackPhase) {
  return a.orderIndex - b.orderIndex;
}

function getTrackPhases(phases: TrackPhase[], trackId: string) {
  return phases.filter((phase) => phase.trackId === trackId).sort(phaseSorter);
}

function evaluateUnlockRule(rule: string, state: AppState) {
  const [kind, rawValue] = rule.split(":");
  const target = Number(rawValue ?? 0);
  const completedPhases = state.phases.filter((phase) => phase.percent >= 100).length;

  switch (kind) {
    case "exp":
      return state.profile.totalExp >= target;
    case "tasks":
      return state.profile.completedTaskCount >= target;
    case "streak":
      return state.profile.streak >= target;
    case "phases":
      return completedPhases >= target;
    default:
      return false;
  }
}

function ensureActiveTitle(titles: AchievementTitle[], profile: PlayerProfile) {
  const unlockedTitles = titles.filter((title) => title.unlocked);
  const activeTitle = unlockedTitles.find((title) => title.id === profile.activeTitleId);
  const fallbackTitle = activeTitle ?? unlockedTitles[0] ?? null;

  return {
    titles: titles.map((title) => ({
      ...title,
      active: fallbackTitle ? title.id === fallbackTitle.id : false,
    })),
    activeTitleId: fallbackTitle?.id ?? null,
  };
}

function refreshTitles(state: AppState, unlockedAt: string) {
  const titles = state.titles.map((title) => {
    const shouldUnlock = evaluateUnlockRule(title.unlockRule, state);

    if (!shouldUnlock) {
      return title;
    }

    return {
      ...title,
      unlocked: true,
      unlockedAt: title.unlockedAt ?? unlockedAt,
    };
  });

  const active = ensureActiveTitle(titles, state.profile);

  return {
    ...state,
    titles: active.titles,
    profile: {
      ...state.profile,
      activeTitleId: active.activeTitleId,
    },
  };
}

function refreshTracks(state: AppState) {
  const tracks: GrowthTrack[] = state.tracks.map((track) => {
    const ownPhases = getTrackPhases(state.phases, track.id);
    const currentPhase = ownPhases.find((phase) => phase.percent < 100) ?? ownPhases[ownPhases.length - 1] ?? null;
    const overallPercent = ownPhases.length
      ? Math.round(ownPhases.reduce((sum, phase) => sum + phase.percent, 0) / ownPhases.length)
      : 0;
    const completed = ownPhases.length > 0 && ownPhases.every((phase) => phase.percent >= 100);

    return {
      ...track,
      currentPhaseId: currentPhase?.id ?? null,
      overallPercent,
      status: completed ? "completed" : track.status === "paused" ? "paused" : "active",
    };
  });

  return {
    ...state,
    tracks,
  };
}

function withDerivedState(state: AppState, timestamp = new Date().toISOString()) {
  return refreshTitles(refreshTracks(state), timestamp);
}

export function getLevel(totalExp: number) {
  return Math.floor(totalExp / 100) + 1;
}

export function getOpenTasks(tasks: Task[]) {
  return tasks.filter((task) => task.status !== "completed");
}

export function getCurrentTitle(state: AppState) {
  return state.titles.find((title) => title.id === state.profile.activeTitleId) ?? null;
}

export function getCurrentTrack(state: AppState) {
  return (
    state.tracks.find((track) => track.status === "active") ??
    state.tracks.find((track) => track.status === "paused") ??
    state.tracks[0] ??
    null
  );
}

export function getPhaseById(phases: TrackPhase[], phaseId: string | null) {
  return phases.find((phase) => phase.id === phaseId) ?? null;
}

export function getVisibleAttributes(attributes: UserAttribute[], group?: UserAttribute["group"]) {
  return attributes.filter((attribute) => (group ? attribute.group === group : true));
}

export function getTodayCompletions(state: AppState) {
  const today = todayKey();
  return state.settlements.filter((settlement) => settlement.completedAt.startsWith(today));
}

export function normalizeState(input?: Partial<AppState> | null) {
  const fallback = createDefaultState();

  if (!input) {
    return withDerivedState(fallback, new Date().toISOString());
  }

  const merged: AppState = {
    version: fallback.version,
    profile: {
      ...fallback.profile,
      ...input.profile,
    },
    tracks: Array.isArray(input.tracks) ? input.tracks : fallback.tracks,
    phases: Array.isArray(input.phases) ? input.phases : fallback.phases,
    attributes: Array.isArray(input.attributes) ? input.attributes : fallback.attributes,
    measurementEntries: Array.isArray(input.measurementEntries) ? input.measurementEntries : fallback.measurementEntries,
    tasks: Array.isArray(input.tasks) ? input.tasks : fallback.tasks,
    settlements: Array.isArray(input.settlements) ? input.settlements : fallback.settlements,
    rewards: Array.isArray(input.rewards) ? input.rewards : fallback.rewards,
    inspirations: Array.isArray(input.inspirations) ? input.inspirations : fallback.inspirations,
    titles: Array.isArray(input.titles) ? input.titles : fallback.titles,
  };

  return withDerivedState(merged, new Date().toISOString());
}

export function setActiveTitle(state: AppState, titleId: string) {
  const titles = state.titles.map((title) => ({
    ...title,
    active: title.unlocked && title.id === titleId,
  }));

  return {
    ...state,
    titles,
    profile: {
      ...state.profile,
      activeTitleId: titleId,
    },
  };
}

export function buildProfileSummary(state: AppState, userId: string): ProfileSummaryRow {
  return {
    user_id: userId,
    total_exp: state.profile.totalExp,
    coins: state.profile.coins,
    active_title_id: state.profile.activeTitleId,
    streak: state.profile.streak,
    completed_task_count: state.profile.completedTaskCount,
    updated_at: new Date().toISOString(),
  };
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createTrack(name: string, category: string, targetText: string, progressMode: GrowthTrack["progressMode"]) {
  return {
    id: createId("track"),
    name,
    category,
    targetText,
    currentPhaseId: null,
    progressMode,
    overallPercent: 0,
    status: "active" as const,
  };
}

export function createPhase(trackId: string, name: string, orderIndex: number) {
  return {
    id: createId("phase"),
    trackId,
    name,
    orderIndex,
    percent: 0,
    rewardCoin: DEFAULT_PHASE_REWARD,
    rewardTitleId: null,
    rewardText: "",
    rewardClaimed: false,
  };
}

export function createTask(task: Omit<Task, "id" | "createdAt" | "completedAt" | "status" | "rewardExp" | "rewardCoin"> & {
  rewardExp?: number;
  rewardCoin?: number;
}) {
  const defaults = DIFFICULTY_REWARDS[task.difficulty];

  return {
    ...task,
    id: createId("task"),
    rewardExp: task.rewardExp ?? defaults.exp,
    rewardCoin: task.rewardCoin ?? defaults.coin,
    status: "todo" as const,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function createReward(title: string, costCoin: number, description: string, cooldownDays: number): RewardItem {
  return {
    id: createId("reward"),
    title,
    costCoin,
    description,
    cooldownDays,
    enabled: true,
    lastRedeemedAt: null,
  };
}

export function createAttribute(name: string, unit: string, baselineValue: number): UserAttribute {
  return {
    id: createId("attribute"),
    name,
    group: "custom",
    unit,
    currentValue: baselineValue,
    baselineValue,
    visibleOnDashboard: true,
  };
}

export function createInspiration(type: InspirationCard["type"], text: string, imageUrl: string | null, sortOrder: number): InspirationCard {
  return {
    id: createId("inspiration"),
    type,
    text,
    imageUrl,
    active: true,
    sortOrder,
  };
}

export function updateAttributeValue(state: AppState, attributeId: string, value: number, note: string) {
  const nextAttributes = state.attributes.map((attribute) =>
    attribute.id === attributeId
      ? {
          ...attribute,
          currentValue: roundNumber(value),
        }
      : attribute,
  );

  const entry: MeasurementEntry = {
    id: createId("measurement"),
    attributeId,
    value: roundNumber(value),
    note,
    recordedAt: new Date().toISOString(),
  };

  return {
    ...state,
    attributes: nextAttributes,
    measurementEntries: [entry, ...state.measurementEntries].slice(0, 120),
  };
}

export function redeemReward(state: AppState, rewardId: string) {
  const reward = state.rewards.find((item) => item.id === rewardId);

  if (!reward || !reward.enabled || state.profile.coins < reward.costCoin) {
    return state;
  }

  if (reward.lastRedeemedAt && reward.cooldownDays > 0) {
    const nextReadyAt = new Date(reward.lastRedeemedAt);
    nextReadyAt.setDate(nextReadyAt.getDate() + reward.cooldownDays);

    if (Date.now() < nextReadyAt.getTime()) {
      return state;
    }
  }

  return {
    ...state,
    profile: {
      ...state.profile,
      coins: state.profile.coins - reward.costCoin,
    },
    rewards: state.rewards.map((item) =>
      item.id === rewardId
        ? {
            ...item,
            lastRedeemedAt: new Date().toISOString(),
          }
        : item,
    ),
  };
}

function applyAttributeRewards(
  attributes: UserAttribute[],
  effects: AttributeEffect[],
  measurementEntries: MeasurementEntry[],
  taskTitle: string,
  timestamp: string,
) {
  if (effects.length === 0) {
    return {
      attributes,
      measurementEntries,
    };
  }

  const nextEntries: MeasurementEntry[] = [];
  const nextAttributes = attributes.map((attribute) => {
    const effect = effects.find((item) => item.attributeId === attribute.id);

    if (!effect) {
      return attribute;
    }

    const nextValue = roundNumber(attribute.currentValue + effect.delta);

    nextEntries.push({
      id: createId("measurement"),
      attributeId: attribute.id,
      value: nextValue,
      note: `${taskTitle} 奖励`,
      recordedAt: timestamp,
    });

    return {
      ...attribute,
      currentValue: nextValue,
    };
  });

  return {
    attributes: nextAttributes,
    measurementEntries: [...nextEntries, ...measurementEntries].slice(0, 120),
  };
}

function updateProfileAfterCompletion(profile: PlayerProfile, earnedExp: number, earnedCoin: number, timestamp: string) {
  const today = todayKey(new Date(timestamp));
  const yesterday = todayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const sameDay = profile.lastTaskCompletionDate === today;
  const nextStreak = sameDay
    ? profile.streak
    : profile.lastTaskCompletionDate === yesterday
      ? profile.streak + 1
      : 1;

  return {
    ...profile,
    totalExp: profile.totalExp + earnedExp,
    coins: profile.coins + earnedCoin,
    completedTaskCount: profile.completedTaskCount + 1,
    streak: nextStreak,
    lastTaskCompletionDate: today,
  };
}

function applyPhaseProgress(state: AppState, task: Task, timestamp: string) {
  if (!task.linkedPhaseId || task.progressDelta <= 0) {
    return {
      phases: state.phases,
      profile: state.profile,
      unlockedTitles: [] as string[],
      appliedProgress: [] as TaskSettlement["appliedProgress"],
    };
  }

  const targetPhase = state.phases.find((phase) => phase.id === task.linkedPhaseId);

  if (!targetPhase) {
    return {
      phases: state.phases,
      profile: state.profile,
      unlockedTitles: [] as string[],
      appliedProgress: [] as TaskSettlement["appliedProgress"],
    };
  }

  const nextPercent = clampPercent(targetPhase.percent + task.progressDelta);
  let nextProfile = state.profile;
  const unlockedTitles: string[] = [];

  const phases = state.phases.map((phase) => {
    if (phase.id !== task.linkedPhaseId) {
      return phase;
    }

    const justCompleted = phase.percent < 100 && nextPercent >= 100 && !phase.rewardClaimed;

    if (justCompleted) {
      nextProfile = {
        ...nextProfile,
        coins: nextProfile.coins + (phase.rewardCoin || DEFAULT_PHASE_REWARD),
      };

      if (phase.rewardTitleId) {
        unlockedTitles.push(phase.rewardTitleId);
      }
    }

    return {
      ...phase,
      percent: nextPercent,
      rewardClaimed: justCompleted ? true : phase.rewardClaimed,
    };
  });

  return {
    phases,
    profile: nextProfile,
    unlockedTitles,
    appliedProgress: [
      {
        phaseId: targetPhase.id,
        delta: task.progressDelta,
        newPercent: nextPercent,
      },
    ],
  };
}

function updateTaskAfterCompletion(task: Task, timestamp: string) {
  const recurrenceMap: Record<Exclude<Recurrence, "none">, number> = {
    daily: 1,
    weekly: 7,
  };

  if (task.recurrence === "none") {
    return {
      ...task,
      status: "completed" as const,
      completedAt: timestamp,
    };
  }

  return {
    ...task,
    status: "todo" as const,
    completedAt: timestamp,
    dueAt: addDays(task.dueAt, recurrenceMap[task.recurrence]),
  };
}

export function completeTask(state: AppState, taskId: string) {
  const task = state.tasks.find((item) => item.id === taskId);

  if (!task || task.status === "completed") {
    return {
      state,
      settlement: null,
    };
  }

  const timestamp = new Date().toISOString();
  const profileAfterReward = updateProfileAfterCompletion(state.profile, task.rewardExp, task.rewardCoin, timestamp);
  const phaseResult = applyPhaseProgress({ ...state, profile: profileAfterReward }, task, timestamp);
  const attributeResult = applyAttributeRewards(state.attributes, task.attributeEffects, state.measurementEntries, task.title, timestamp);

  const titlesWithPhaseReward = state.titles.map((title) =>
    phaseResult.unlockedTitles.includes(title.id)
      ? {
          ...title,
          unlocked: true,
          unlockedAt: title.unlockedAt ?? timestamp,
        }
      : title,
  );

  const taskSettlement: TaskSettlement = {
    taskId: task.id,
    earnedExp: task.rewardExp,
    earnedCoin: task.rewardCoin + (phaseResult.profile.coins - profileAfterReward.coins),
    appliedProgress: phaseResult.appliedProgress,
    appliedAttributes: task.attributeEffects,
    unlockedTitles: phaseResult.unlockedTitles,
    completedAt: timestamp,
  };

  const nextState = withDerivedState(
    {
      ...state,
      profile: phaseResult.profile,
      phases: phaseResult.phases,
      attributes: attributeResult.attributes,
      measurementEntries: attributeResult.measurementEntries,
      titles: titlesWithPhaseReward,
      tasks: state.tasks.map((item) => (item.id === task.id ? updateTaskAfterCompletion(item, timestamp) : item)),
      settlements: [taskSettlement, ...state.settlements].slice(0, 60),
    },
    timestamp,
  );

  const newlyUnlockedTitles = nextState.titles
    .filter(
      (title) =>
        title.unlocked &&
        !state.titles.find((previous) => previous.id === title.id)?.unlocked,
    )
    .map((title) => title.id);

  return {
    state: {
      ...nextState,
      settlements: nextState.settlements.map((settlement, index) =>
        index === 0
          ? {
              ...settlement,
              unlockedTitles: Array.from(new Set([...settlement.unlockedTitles, ...newlyUnlockedTitles])),
            }
          : settlement,
      ),
    },
    settlement: {
      ...taskSettlement,
      unlockedTitles: Array.from(new Set([...taskSettlement.unlockedTitles, ...newlyUnlockedTitles])),
    },
  };
}
