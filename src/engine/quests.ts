import type { QuestStatus, QuestUpdate } from '../shared/messages';
import { deriveQuestStatus, isQuestExpired } from '../shared/status';
import { isRunnableTask, pickTaskType } from './tasks';

export interface QuestLike {
  id: string;
  config: {
    expiresAt?: string | null;
    startsAt?: string | null;
    features?: number[] | null;
    taskConfig?: { tasks?: Record<string, unknown> } | null;
    taskConfigV2?: { tasks?: Record<string, unknown> } | null;
    messages?: { questName?: string };
    rewardName?: string;
    rewardAmount?: number;
    rewardSKUId?: string;
  };
  userStatus?: {
    completedAt?: string | null;
    enrolledAt?: string | null;
    claimedAt?: string | null;
    progress?: Record<string, { value?: number }>;
    streamProgressSeconds?: number;
  };
}

export interface QuestState {
  quest: QuestLike;
  id: string;
  taskType: string;
  secondsNeeded: number;
  currentProgress: number;
  completed: boolean;
  claimed: boolean;
  status: QuestStatus;
  runnable: boolean;
  expiresAt: string | null;
  questName: string;
  features: number[];
}

export function buildQuestState(quest: QuestLike, now: number = Date.now()): QuestState | null {
  if (isQuestExpired(quest.config.expiresAt, now)) return null;

  const isCompleted = !!quest.userStatus?.completedAt;
  const isEnrolled = !!quest.userStatus?.enrolledAt;
  const isClaimed = !!quest.userStatus?.claimedAt;

  const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
  const taskType = pickTaskType(taskConfig?.tasks);
  if (!taskType) return null;

  const taskData = taskConfig?.tasks?.[taskType] as { target?: number } | undefined;
  const runnable = isRunnableTask(taskType);
  const secondsNeeded = taskData?.target ?? 0;
  const currentProgress =
    quest.userStatus?.progress?.[taskType]?.value ?? quest.userStatus?.streamProgressSeconds ?? 0;

  const status = deriveQuestStatus(
    isCompleted,
    isClaimed,
    isEnrolled,
    runnable
  );

  return {
    quest,
    id: quest.id,
    taskType,
    secondsNeeded,
    currentProgress,
    completed: isCompleted,
    claimed: isClaimed,
    status,
    runnable,
    expiresAt: quest.config.expiresAt ?? null,
    questName: quest.config.messages?.questName ?? 'Unknown Quest',
    features: quest.config.features ?? []
  };
}

export { isQuestExpired };

let featureNameResolver: ((num: number) => string) | null = null;

export function setFeatureNameResolver(fn: ((num: number) => string) | null): void {
  featureNameResolver = fn;
}

export function featureName(num: number): string {
  return featureNameResolver ? featureNameResolver(num) : `f${num}`;
}

export function toQuestUpdate(state: QuestState, active: boolean): QuestUpdate {
  return {
    id: state.id,
    name: state.questName,
    taskType: state.taskType,
    progress: Math.floor(state.currentProgress),
    target: state.secondsNeeded,
    expiresAt: state.expiresAt,
    status: state.status,
    completed: state.completed,
    claimed: state.claimed,
    active,
    features: state.features.map(featureName),
    configJson: configJson(state),
    startsAt: state.quest.config?.startsAt ?? null,
    rewardName: state.quest.config?.rewardName,
    rewardAmount: state.quest.config?.rewardAmount,
    rewardSku: state.quest.config?.rewardSKUId,
    applications: applicationsFor(state)
  };
}

function applicationsFor(state: QuestState): string[] | undefined {
  try {
    const tasks =
      state.quest.config?.taskConfigV2?.tasks ?? state.quest.config?.taskConfig?.tasks;
    const task = tasks?.[state.taskType] as { applications?: { id?: string }[] } | undefined;
    const apps = task?.applications;
    if (!apps || apps.length === 0) return undefined;
    return apps.map((a) => a.id).filter((id): id is string => !!id);
  } catch (error) {
    return undefined;
  }
}

function configJson(state: QuestState): string | undefined {
  try {
    const raw = JSON.stringify(state.quest.config ?? null);
    if (!raw) return undefined;
    return raw.length > 6000 ? `${raw.slice(0, 6000)}\n…(truncated)` : raw;
  } catch (error) {
    return undefined;
  }
}
