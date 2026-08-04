export function formatRemaining(expiresAt: string | null, now: number = Date.now()): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return 'Expired';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `expires in ${d}d ${h}h`;
  if (h > 0) return `expires in ${h}h ${m}m`;
  return `expires in ${m}m`;
}

export function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
