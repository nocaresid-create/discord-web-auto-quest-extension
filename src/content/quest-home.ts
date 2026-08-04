import { mount, unmount } from 'svelte';
import QuestRoot from './ui/QuestRoot.svelte';
import * as store from './ui/questStore.svelte';
import * as apiStore from './ui/apiInspectorStore.svelte';
import { readLastError, safeSendMessage } from '../shared/chrome';
import { COLORS } from '../shared/constants';
import { MESSAGE_PREFIX, isQuestMessage, type ControlType } from '../shared/messages';

let host: HTMLDivElement | null = null;
let app: ReturnType<typeof mount> | null = null;
let autoStartTriggered = false;
let injectionRetried = false;

function isQuestHome(): boolean {
  return window.location.pathname.includes('/quest-home');
}

function sendControl(type: ControlType, data?: unknown): void {
  window.postMessage({ prefix: MESSAGE_PREFIX, type, data: data ?? null }, '*');
}

function executeQuestCode(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    store.showFlash('Extension Error', COLORS.red, 4000);
    return;
  }
  store.showFlash('Starting...', COLORS.mutedBright);
  safeSendMessage({ action: 'executeQuestCode' }, (response) => {
    try {
      const err = readLastError();
      if (err) {
        const message = String((err as { message?: unknown })?.message ?? err);
        console.error('Discord Auto Quest Error:', message);
        if (message.includes('context invalidated')) {
          store.showToast('Extension was reloaded — refresh this page (Ctrl+Shift+R)');
          store.showFlash('Reload Discord page (F5)', COLORS.red, 4000);
        } else {
          store.showFlash(`Error: ${message}`, COLORS.red, 4000);
        }
        return;
      }
      if (response && (response as { success?: boolean }).success) {
        store.showFlash((response as { skipped?: boolean }).skipped ? 'Already running' : 'Running...', COLORS.blurple);
        return;
      }
      const message = (response as { error?: string } | null)?.error;
      if (!response) {
        console.error('Discord Auto Quest Error: no response from background (extension reloaded?)');
        store.showFlash('No response from extension — reload & refresh (Ctrl+Shift+R)', COLORS.red, 4000);
        return;
      }
      console.error('Discord Auto Quest Error:', message || response);
      store.showFlash(message ? `Error: ${message}` : 'Error', COLORS.red, 4000);
      if (!injectionRetried) {
        injectionRetried = true;
        setTimeout(() => executeQuestCode(), 3500);
      }
    } catch (e) {
      /* ignore */
    }
  });
}

function updateBadgeCounts(): void {
  safeSendMessage({ action: 'updateBadge', data: store.counts() });
}

function resetBadge(): void {
  safeSendMessage({ action: 'updateBadge', data: { total: 0, running: 0, available: 0, done: 0 } });
}

function relocateShadowStyles(shadow: ShadowRoot): void {
  for (const el of Array.from(document.head.querySelectorAll('style'))) {
    if (el.textContent.includes('dqc-shadow-styles')) {
      shadow.appendChild(el);
      return;
    }
  }
}

function createQuestHost(): void {
  if (host) return;
  host = document.createElement('div');
  host.id = 'DiscordQuestHost';
  const shadow = host.attachShadow({ mode: 'open' });
  relocateShadowStyles(shadow);
  document.body.appendChild(host);
  app = mount(QuestRoot, {
    target: shadow,
    props: {
      onRun: executeQuestCode,
      onTogglePanel: () => store.togglePanel(),
      onStop: () => sendControl('QUEST_STOP'),
      onRefresh: () => sendControl('QUEST_REFRESH'),
      onSkip: (id: string) => sendControl('QUEST_SKIP', { id }),
      onClaim: (id: string) => sendControl('QUEST_CLAIM', { id })
    }
  });
  sendControl('QUEST_GET_LIST');
}

function removeQuestHost(): void {
  if (app) {
    unmount(app);
    app = null;
  }
  if (host) {
    host.remove();
    host = null;
  }
  store.reset();
}

function fetchVersion(): void {
  safeSendMessage({ action: 'getVersion' }, (response) => {
    try {
      if (!readLastError() && response && (response as { version?: string }).version) {
        store.setVersion((response as { version: string }).version);
      }
    } catch (e) {
      /* ignore */
    }
  });
}

function handleMessage({ source, data }: MessageEvent): void {
  if (source !== window || !isQuestMessage(data)) return;

  if (data.type === 'QUEST_LIST') {
    store.setQuests(data.data);
    updateBadgeCounts();
  } else if (data.type === 'QUEST_UPDATE') {
    const q = data.data;
    const prev = store.getQuest(q.id);
    const isNoOp =
      prev &&
      prev.progress === q.progress &&
      prev.completed === q.completed &&
      prev.status === q.status &&
      prev.taskType === q.taskType &&
      prev.name === q.name &&
      prev.active === q.active &&
      prev.claimed === q.claimed;
    store.upsertQuest(q);
    if (!isNoOp) {
      updateBadgeCounts();
      if (q.completed && (!prev || !prev.completed)) {
        store.onQuestCompleted();
        store.showToast(`Quest completed: ${q.name}`);
        safeSendMessage({ action: 'notifyQuestCompleted', questName: q.name });
      }
    }
  } else if (data.type === 'QUEST_ACTIVE') {
    store.setActive(data.data.id, data.data.active);
    updateBadgeCounts();
  } else if (data.type === 'API_EVENT') {
    apiStore.addApiEvent(data.data);
  } else if (data.type === 'QUEST_ENROLL_RESULT') {
    const { name, reason } = data.data;
    store.showToast(
      name === 'all'
        ? `Auto-accept blocked: ${reason}`
        : `Auto-accept failed: ${name} (${reason})`
    );
  } else if (data.type === 'QUEST_RATE_LIMIT') {
    const { until, reason } = data.data;
    if (until != null) {
      store.setRateLimit(Number(until), reason || 'rate limited');
      store.showToast(`Rate limited by Discord — ${reason || 'auto-accept paused'}`);
    } else {
      store.clearRateLimit();
    }
  }
}

function autoStartIfEnabled(): void {
  if (autoStartTriggered) return;
  autoStartTriggered = true;
  console.info('Discord Auto Quest: Auto-start running quests...');
  setTimeout(() => executeQuestCode(), 1500);
}

function init(): void {
  window.addEventListener('message', handleMessage);
  setInterval(() => {
    store.tick();
  }, 1000);

  if (isQuestHome()) {
    createQuestHost();
    fetchVersion();
    autoStartIfEnabled();
  } else {
    resetBadge();
  }

  let lastUrl = window.location.href;
  new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;
    if (isQuestHome()) {
      createQuestHost();
      fetchVersion();
      autoStartIfEnabled();
    } else {
      removeQuestHost();
      resetBadge();
    }
  }).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
