export type ProgressMode = "manual" | "task-linked";
export type TrackStatus = "active" | "paused" | "completed";
export type AttributeGroup = "body" | "growth" | "custom";
export type Difficulty = "easy" | "normal" | "challenge";
export type Recurrence = "none" | "daily" | "weekly";
export type TaskStatus = "todo" | "completed";
export type InspirationType = "quote" | "image";
export type SyncStatus = "demo" | "connecting" | "signed-out" | "ready" | "saving" | "error";

export interface GrowthTrack {
  id: string;
  name: string;
  category: string;
  targetText: string;
  currentPhaseId: string | null;
  progressMode: ProgressMode;
  overallPercent: number;
  status: TrackStatus;
}

export interface TrackPhase {
  id: string;
  trackId: string;
  name: string;
  orderIndex: number;
  percent: number;
  rewardCoin: number;
  rewardTitleId: string | null;
  rewardText: string;
  rewardClaimed?: boolean;
}

export interface UserAttribute {
  id: string;
  name: string;
  group: AttributeGroup;
  unit: string;
  currentValue: number;
  baselineValue: number;
  visibleOnDashboard: boolean;
}

export interface MeasurementEntry {
  id: string;
  attributeId: string;
  value: number;
  note: string;
  recordedAt: string;
}

export interface AttributeEffect {
  attributeId: string;
  delta: number;
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  difficulty: Difficulty;
  dueAt: string | null;
  recurrence: Recurrence;
  linkedTrackId: string | null;
  linkedPhaseId: string | null;
  progressDelta: number;
  rewardExp: number;
  rewardCoin: number;
  attributeEffects: AttributeEffect[];
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface SettlementProgress {
  phaseId: string;
  delta: number;
  newPercent: number;
}

export interface TaskSettlement {
  taskId: string;
  earnedExp: number;
  earnedCoin: number;
  appliedProgress: SettlementProgress[];
  appliedAttributes: AttributeEffect[];
  unlockedTitles: string[];
  completedAt: string;
}

export interface RewardItem {
  id: string;
  title: string;
  costCoin: number;
  description: string;
  cooldownDays: number;
  enabled: boolean;
  lastRedeemedAt?: string | null;
}

export interface InspirationCard {
  id: string;
  type: InspirationType;
  text: string;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export interface AchievementTitle {
  id: string;
  name: string;
  unlockRule: string;
  badgeStyle: string;
  active: boolean;
  unlocked: boolean;
  unlockedAt?: string | null;
}

export interface PlayerProfile {
  totalExp: number;
  coins: number;
  activeTitleId: string | null;
  streak: number;
  completedTaskCount: number;
  lastTaskCompletionDate: string | null;
  installedAt: string;
}

export interface AppState {
  version: number;
  profile: PlayerProfile;
  tracks: GrowthTrack[];
  phases: TrackPhase[];
  attributes: UserAttribute[];
  measurementEntries: MeasurementEntry[];
  tasks: Task[];
  settlements: TaskSettlement[];
  rewards: RewardItem[];
  inspirations: InspirationCard[];
  titles: AchievementTitle[];
}

export interface ProfileSummaryRow {
  user_id: string;
  total_exp: number;
  coins: number;
  active_title_id: string | null;
  streak: number;
  completed_task_count: number;
  updated_at: string;
}
