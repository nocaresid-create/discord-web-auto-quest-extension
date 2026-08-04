import type { ApiEvent } from '../../shared/messages';

export const apiStore = $state({
  events: [] as ApiEvent[],
  open: false,
  questOnly: false,
  search: ''
});

const MAX_EVENTS = 150;

export function addApiEvent(evt: ApiEvent): void {
  apiStore.events.unshift(evt);
  if (apiStore.events.length > MAX_EVENTS) {
    apiStore.events.length = MAX_EVENTS;
  }
}

export function clearApiEvents(): void {
  apiStore.events = [];
}

export function toggleApiInspector(): void {
  apiStore.open = !apiStore.open;
}

export function filteredEvents(): ApiEvent[] {
  const q = apiStore.search.trim().toLowerCase();
  return apiStore.events.filter((e) => {
    if (apiStore.questOnly && !/quest/i.test(e.url)) return false;
    if (q && !(e.url + e.reqBody + e.resBody).toLowerCase().includes(q)) return false;
    return true;
  });
}
