export const MESSAGE_PREFIX = 'DISCORD_QUEST_COMPLETER';

export type QuestStatus = 'AVAILABLE' | 'RUNNING' | 'COMPLETED' | 'CLAIMED' | 'SKIPPED' | 'UNSUPPORTED';

export interface QuestUpdate {
  id: string;
  name: string;
  taskType: string;
  progress: number;
  target: number;
  expiresAt: string | null;
  status: QuestStatus;
  completed: boolean;
  claimed: boolean;
  active: boolean;
  features?: string[];
  configJson?: string;
  startsAt?: string | null;
  rewardName?: string;
  rewardAmount?: number;
  rewardSku?: string;
  applications?: string[];
}

export interface QuestListMessage {
  prefix: string;
  type: 'QUEST_LIST';
  data: QuestUpdate[];
}

export interface QuestUpdateMessage {
  prefix: string;
  type: 'QUEST_UPDATE';
  data: QuestUpdate;
}

export interface QuestActiveMessage {
  prefix: string;
  type: 'QUEST_ACTIVE';
  data: { id: string; name: string; active: boolean };
}

export interface ApiEvent {
  id: number;
  method: string;
  url: string;
  status: number;
  reqBody: string;
  resBody: string;
  at: number;
}

export interface ApiEventMessage {
  prefix: string;
  type: 'API_EVENT';
  data: ApiEvent;
}

export type QuestMessage =
  | QuestListMessage
  | QuestUpdateMessage
  | QuestActiveMessage
  | ApiEventMessage;

export type ControlType = 'QUEST_STOP' | 'QUEST_REFRESH' | 'QUEST_GET_LIST' | 'QUEST_SKIP' | 'QUEST_CLAIM';

export interface ControlMessage {
  prefix: string;
  type: ControlType;
  data: unknown;
}

export interface QuestConfig {
  concurrency: number;
  autoAccept: boolean;
  video: { stepSize: number; minDelay: number; maxDelay: number };
  heartbeat: { minDelay: number; maxDelay: number };
  autoRefreshMinutes?: number;
  version?: string;
  supportedTasks?: string[];
  userAgent?: string;
  notifications?: boolean;
  autoStart?: boolean;
}

export interface Settings {
  autoStart: boolean;
  autoAccept: boolean;
  notifications: boolean;
  concurrency: number;
  stepSize: number;
  autoRefresh: number;
}

export interface QuestCounts {
  total: number;
  active: number;
  queued: number;
  available: number;
  done: number;
  running: number;
}

export function isQuestMessage(data: unknown): data is QuestMessage {
  const d = data as Partial<QuestMessage>;
  return !!d && d.prefix === MESSAGE_PREFIX && typeof d.type === 'string';
}

export function isControlMessage(data: unknown): data is ControlMessage {
  const d = data as Partial<ControlMessage>;
  return !!d && d.prefix === MESSAGE_PREFIX && typeof d.type === 'string';
}
