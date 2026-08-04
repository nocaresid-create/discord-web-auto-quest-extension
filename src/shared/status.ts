import type { QuestStatus, QuestUpdate } from './messages';

export function deriveQuestStatus(
  isCompleted: boolean,
  isClaimed: boolean,
  isEnrolled: boolean,
  isSupported: boolean
): QuestStatus {
  if (isCompleted) return isClaimed ? 'CLAIMED' : 'COMPLETED';
  if (!isEnrolled) return 'AVAILABLE';
  return isSupported ? 'RUNNING' : 'UNSUPPORTED';
}

export function questPriority(quest: QuestUpdate | { active?: boolean; status?: string }): number {
  if (quest.active) return 0;
  if (quest.status === 'RUNNING') return 1;
  if (quest.status === 'AVAILABLE') return 2;
  if (quest.status === 'UNSUPPORTED') return 3;
  if (quest.status === 'COMPLETED') return 4;
  if (quest.status === 'CLAIMED') return 5;
  return 6;
}

export function isQuestExpired(expiresAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now;
}
