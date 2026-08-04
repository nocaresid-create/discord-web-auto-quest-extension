import { RUNNABLE_TASKS, WATCH_TASKS } from '../shared/constants';

export function pickTaskType(tasks: Record<string, unknown> | null | undefined): string | null {
  if (!tasks) return null;
  const keys = Object.keys(tasks);
  if (keys.length === 0) return null;
  const watch = keys.find((k) => WATCH_TASKS.includes(k));
  if (watch) return watch;
  const runnable = keys.find((k) => (RUNNABLE_TASKS as readonly string[]).includes(k));
  if (runnable) return runnable;
  return keys[0];
}

export function isWatchTask(taskType: string | null | undefined): boolean {
  return !!taskType && taskType.includes('WATCH');
}

export function isRunnableTask(taskType: string | null | undefined): boolean {
  return !!taskType && (RUNNABLE_TASKS as readonly string[]).includes(taskType);
}
