import type { QuestCounts, QuestUpdate } from '../../shared/messages';
import { questPriority } from '../../shared/status';

export const questStore = $state({
  quests: [] as QuestUpdate[],
  buttonFlash: null as { message: string; color: string } | null,
  toast: { text: '', visible: false },
  expanded: false,
  panelVersion: '?',
  sessionDone: 0,
  sessionStartTs: null as number | null,
  nowTs: Date.now(),
  rateLimit: { until: null as number | null, reason: '' }
});

let flashTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function sorted(list: QuestUpdate[]): QuestUpdate[] {
  return [...list].sort((a, b) => questPriority(a) - questPriority(b));
}

export function setQuests(list: QuestUpdate[]): void {
  questStore.quests = sorted(list);
}

export function upsertQuest(q: QuestUpdate): void {
  const i = questStore.quests.findIndex((x) => x.id === q.id);
  if (i >= 0) questStore.quests[i] = q;
  else questStore.quests.push(q);
  questStore.quests = sorted(questStore.quests);
}

export function setActive(id: string, active: boolean): void {
  const q = questStore.quests.find((x) => x.id === id);
  if (!q) return;
  q.active = active;
  questStore.quests = sorted(questStore.quests);
}

export function getQuest(id: string): QuestUpdate | undefined {
  return questStore.quests.find((x) => x.id === id);
}

export function counts(): QuestCounts {
  const active = questStore.quests.filter((q) => q.active).length;
  const queued = questStore.quests.filter((q) => q.status === 'RUNNING' && !q.completed && !q.active).length;
  const available = questStore.quests.filter((q) => q.status === 'AVAILABLE').length;
  const done = questStore.quests.filter((q) => q.completed).length;
  return { total: questStore.quests.length, active, queued, available, done, running: active + queued };
}

export function onQuestCompleted(): void {
  if (!questStore.sessionStartTs) questStore.sessionStartTs = Date.now();
  questStore.sessionDone++;
}

export function tick(): void {
  questStore.nowTs = Date.now();
}

export function setVersion(version: string): void {
  questStore.panelVersion = version;
}

export function togglePanel(): void {
  questStore.expanded = !questStore.expanded;
}

export function showToast(text: string): void {
  questStore.toast = { text, visible: true };
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    questStore.toast = { ...questStore.toast, visible: false };
  }, 4000);
}

export function showFlash(message: string, color: string, duration: number = 2000): void {
  questStore.buttonFlash = { message, color };
  if (flashTimer !== null) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    questStore.buttonFlash = null;
  }, duration);
}

export function setRateLimit(until: number | null, reason: string): void {
  questStore.rateLimit = { until, reason };
}

export function clearRateLimit(): void {
  questStore.rateLimit = { until: null, reason: '' };
}

export function reset(): void {
  questStore.quests = [];
  questStore.sessionDone = 0;
  questStore.sessionStartTs = null;
  questStore.expanded = false;
  questStore.toast = { text: '', visible: false };
  questStore.buttonFlash = null;
  questStore.rateLimit = { until: null, reason: '' };
}
