import type {
  AchievementTitle,
  AppState,
  GrowthTrack,
  InspirationCard,
  MeasurementEntry,
  RewardItem,
  Task,
  TrackPhase,
  UserAttribute,
} from "@/lib/types";

function toIsoOffset(days = 0, hours = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours, 0, 0, 0);
  return date.toISOString();
}

const bodyAttributes: UserAttribute[] = [
  { id: "body-weight", name: "体重", group: "body", unit: "kg", currentValue: 78, baselineValue: 82, visibleOnDashboard: true },
  { id: "body-fat", name: "体脂率", group: "body", unit: "%", currentValue: 22, baselineValue: 26, visibleOnDashboard: true },
  { id: "body-sleep", name: "睡眠时长", group: "body", unit: "h", currentValue: 7.2, baselineValue: 6.2, visibleOnDashboard: true },
  { id: "body-steps", name: "步数", group: "body", unit: "步", currentValue: 8200, baselineValue: 5200, visibleOnDashboard: true },
  { id: "body-energy", name: "精力评分", group: "body", unit: "分", currentValue: 76, baselineValue: 58, visibleOnDashboard: true },
];

const growthAttributes: UserAttribute[] = [
  { id: "growth-learning", name: "学习力", group: "growth", unit: "分", currentValue: 72, baselineValue: 55, visibleOnDashboard: true },
  { id: "growth-focus", name: "专注力", group: "growth", unit: "分", currentValue: 68, baselineValue: 48, visibleOnDashboard: true },
  { id: "growth-execution", name: "执行力", group: "growth", unit: "分", currentValue: 80, baselineValue: 60, visibleOnDashboard: true },
  { id: "growth-mind", name: "精神状态", group: "growth", unit: "分", currentValue: 74, baselineValue: 52, visibleOnDashboard: true },
];

const tracks: GrowthTrack[] = [
  {
    id: "track-fat-loss",
    name: "减脂进阶",
    category: "身体",
    targetText: "建立稳定的作息、饮食和运动节奏，把减脂变成长期习惯。",
    currentPhaseId: "phase-fat-loss-1",
    progressMode: "task-linked",
    overallPercent: 35,
    status: "active",
  },
  {
    id: "track-english",
    name: "英语破境",
    category: "学习",
    targetText: "从碎片输入过渡到稳定输出，逐步建立完整表达能力。",
    currentPhaseId: "phase-english-1",
    progressMode: "task-linked",
    overallPercent: 28,
    status: "active",
  },
];

const phases: TrackPhase[] = [
  { id: "phase-fat-loss-1", trackId: "track-fat-loss", name: "建立节奏", orderIndex: 1, percent: 68, rewardCoin: 100, rewardTitleId: "title-breakthrough", rewardText: "连续两周完成饮食和运动基础任务。", rewardClaimed: false },
  { id: "phase-fat-loss-2", trackId: "track-fat-loss", name: "稳定输出", orderIndex: 2, percent: 26, rewardCoin: 120, rewardTitleId: null, rewardText: "把运动频率和睡眠时长稳定下来。", rewardClaimed: false },
  { id: "phase-fat-loss-3", trackId: "track-fat-loss", name: "习惯固化", orderIndex: 3, percent: 10, rewardCoin: 160, rewardTitleId: "title-consistency", rewardText: "让健康行为进入自动执行状态。", rewardClaimed: false },
  { id: "phase-english-1", trackId: "track-english", name: "输入重建", orderIndex: 1, percent: 52, rewardCoin: 100, rewardTitleId: null, rewardText: "连续两周完成单词和听力输入。", rewardClaimed: false },
  { id: "phase-english-2", trackId: "track-english", name: "表达启动", orderIndex: 2, percent: 18, rewardCoin: 120, rewardTitleId: "title-speaker", rewardText: "开始做短句输出和口头表达。", rewardClaimed: false },
  { id: "phase-english-3", trackId: "track-english", name: "系统输出", orderIndex: 3, percent: 8, rewardCoin: 160, rewardTitleId: null, rewardText: "完成一轮听说读写闭环训练。", rewardClaimed: false },
];

const tasks: Task[] = [
  {
    id: "task-walk",
    title: "30 分钟快走",
    detail: "完成今天的基础运动量。",
    difficulty: "normal",
    dueAt: toIsoOffset(0, 5),
    recurrence: "daily",
    linkedTrackId: "track-fat-loss",
    linkedPhaseId: "phase-fat-loss-1",
    progressDelta: 10,
    rewardExp: 25,
    rewardCoin: 10,
    attributeEffects: [{ attributeId: "body-energy", delta: 2 }],
    status: "todo",
    createdAt: toIsoOffset(-2, 0),
    completedAt: null,
  },
  {
    id: "task-vocab",
    title: "背 25 个单词",
    detail: "输入一轮单词并快速复习 5 句例句。",
    difficulty: "easy",
    dueAt: toIsoOffset(0, 8),
    recurrence: "daily",
    linkedTrackId: "track-english",
    linkedPhaseId: "phase-english-1",
    progressDelta: 8,
    rewardExp: 10,
    rewardCoin: 5,
    attributeEffects: [{ attributeId: "growth-learning", delta: 2 }],
    status: "todo",
    createdAt: toIsoOffset(-2, 0),
    completedAt: null,
  },
  {
    id: "task-sleep",
    title: "23:30 前入睡",
    detail: "保证恢复质量，把精力拉回来。",
    difficulty: "normal",
    dueAt: toIsoOffset(0, 12),
    recurrence: "daily",
    linkedTrackId: "track-fat-loss",
    linkedPhaseId: "phase-fat-loss-2",
    progressDelta: 6,
    rewardExp: 25,
    rewardCoin: 10,
    attributeEffects: [{ attributeId: "body-sleep", delta: 0.2 }],
    status: "todo",
    createdAt: toIsoOffset(-1, 0),
    completedAt: null,
  },
];

const rewards: RewardItem[] = [
  { id: "reward-milk-tea", title: "奶茶一杯", costCoin: 60, description: "完成阶段推进后的即时奖励。", cooldownDays: 1, enabled: true, lastRedeemedAt: null },
  { id: "reward-gaming", title: "30 分钟游戏时间", costCoin: 80, description: "把娱乐也纳入计划内奖励。", cooldownDays: 1, enabled: true, lastRedeemedAt: null },
];

const inspirations: InspirationCard[] = [
  { id: "inspiration-1", type: "quote", text: "谁终将声震人间，必长久深自缄默。", imageUrl: null, active: true, sortOrder: 1 },
  { id: "inspiration-2", type: "quote", text: "所谓无底深渊，下去，也是前程万里。", imageUrl: null, active: true, sortOrder: 2 },
];

const titles: AchievementTitle[] = [
  { id: "title-initiate", name: "见习者", unlockRule: "exp:0", badgeStyle: "emerald", active: true, unlocked: true, unlockedAt: toIsoOffset(-7, 0) },
  { id: "title-breakthrough", name: "破境者", unlockRule: "phases:1", badgeStyle: "rose", active: false, unlocked: false, unlockedAt: null },
  { id: "title-speaker", name: "开口者", unlockRule: "exp:300", badgeStyle: "sky", active: false, unlocked: false, unlockedAt: null },
  { id: "title-consistency", name: "恒进者", unlockRule: "streak:7", badgeStyle: "violet", active: false, unlocked: false, unlockedAt: null },
];

function buildMeasurementEntries(items: UserAttribute[]): MeasurementEntry[] {
  return items.map((attribute, index) => ({
    id: `measurement-${attribute.id}`,
    attributeId: attribute.id,
    value: attribute.currentValue,
    note: "系统初始化基线",
    recordedAt: toIsoOffset(-(index % 3), index),
  }));
}

export function createDefaultState(): AppState {
  const attributes = [...bodyAttributes, ...growthAttributes];

  return {
    version: 1,
    profile: {
      totalExp: 185,
      coins: 140,
      activeTitleId: "title-initiate",
      streak: 3,
      completedTaskCount: 4,
      lastTaskCompletionDate: toIsoOffset(-1, 0).slice(0, 10),
      installedAt: toIsoOffset(-7, 0),
    },
    tracks,
    phases,
    attributes,
    measurementEntries: buildMeasurementEntries(attributes),
    tasks,
    settlements: [],
    rewards,
    inspirations,
    titles,
  };
}
