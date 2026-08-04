import type { QuestConfig, Settings } from './shared/messages';

const DEFAULT_CONFIG: QuestConfig = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0.0 Chrome/120.0.0.0 Electron/28.0.0 Safari/537.36',
  supportedTasks: ['WATCH_VIDEO', 'PLAY_ON_DESKTOP', 'STREAM_ON_DESKTOP', 'PLAY_ACTIVITY', 'WATCH_VIDEO_ON_MOBILE', 'PLAY_ON_XBOX', 'PLAY_ON_PLAYSTATION', 'CLOUD_GAMING_ACTIVITY'],
  autoStart: true,
  autoAccept: true,
  notifications: true,
  concurrency: 2,
  video: { stepSize: 1, minDelay: 1000, maxDelay: 1500 },
  heartbeat: { minDelay: 20000, maxDelay: 22000 }
};

const SETTINGS_KEYS: (keyof Settings)[] = [
  'concurrency',
  'autoRefresh'
];

chrome.runtime.onInstalled.addListener(() => {
  console.info('Discord Auto Quest extension installed (v' + chrome.runtime.getManifest().version + ')');
});

function getDefaultSettings(): Settings {
  return {
    autoStart: true,
    autoAccept: true,
    notifications: true,
    concurrency: 2,
    stepSize: 1,
    autoRefresh: 0
  };
}

async function loadSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get('settings');
    const settings = (stored.settings || {}) as Partial<Settings>;
    const merged: Settings = { ...getDefaultSettings() };
    for (const key of SETTINGS_KEYS) {
      if (settings[key] !== undefined) merged[key] = settings[key] as never;
    }
    merged.concurrency = Math.max(1, Math.min(100, Math.round(merged.concurrency) || 1));
    merged.stepSize = Math.max(1, Math.min(60, Math.round(merged.stepSize) || 1));
    merged.autoRefresh = Math.max(0, Math.min(60, Math.round(merged.autoRefresh) || 0));
    return merged;
  } catch (e) {
    return getDefaultSettings();
  }
}

async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const settings = await loadSettings();
  for (const key of SETTINGS_KEYS) {
    if (patch[key] !== undefined) settings[key] = patch[key] as never;
  }
  await chrome.storage.local.set({ settings });
  return settings;
}

async function getConfig(): Promise<QuestConfig & { version: string; autoRefreshMinutes: number }> {
  const settings = await loadSettings();
  return {
    ...DEFAULT_CONFIG,
    version: chrome.runtime.getManifest().version,
    autoStart: true,
    autoAccept: true,
    notifications: true,
    concurrency: settings.concurrency,
    autoRefreshMinutes: settings.autoRefresh,
    video: { ...DEFAULT_CONFIG.video }
  };
}

function notifyQuestCompleted(questName?: string): void {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icon.png'),
      title: 'Quest Completed',
      message: questName || 'A quest has been completed',
      priority: 2
    });
  } catch (e) {
    /* ignore */
  }
}

interface BadgeData {
  running?: number;
  available?: number;
  done?: number;
  total?: number;
}

function updateBadge({ running, available, done, total }: BadgeData): void {
  const count = (running || 0) + (available || 0);
  const text = count > 0 ? String(count) : (total || 0) > 0 ? String(total) : '';
  try {
    chrome.action.setBadgeText({ text });
    let color = '#5865f2';
    if ((running || 0) === 0 && (available || 0) > 0) color = '#f0b132';
    if ((running || 0) === 0 && (available || 0) === 0 && (total || 0) > 0) color = '#23a559';
    chrome.action.setBadgeBackgroundColor({ color });
  } catch (e) {
    /* ignore */
  }
}

interface RuntimeRequest {
  action?: string;
  data?: BadgeData;
  questName?: string;
  settings?: Partial<Settings>;
  token?: string;
}

let lastQuestCodeRunAt = 0;

chrome.runtime.onMessage.addListener((request: RuntimeRequest, sender, sendResponse) => {
  if (request.action === 'getVersion') {
    sendResponse({ version: chrome.runtime.getManifest().version });
    return false;
  }

  if (request.action === 'getConfig') {
    getConfig()
      .then((config) => sendResponse({ config }))
      .catch(() => sendResponse({ config: null }));
    return true;
  }

  if (request.action === 'getSettings') {
    loadSettings().then((settings) => sendResponse({ settings }));
    return true;
  }

  if (request.action === 'saveSettings') {
    saveSettings(request.settings || {}).then((settings) => sendResponse({ ok: true, settings }));
    return true;
  }

  if (request.action === 'updateBadge') {
    updateBadge(request.data || {});
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === 'notifyQuestCompleted') {
    notifyQuestCompleted(request.questName);
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === 'getCurrentToken') {
    chrome.tabs
      .query({ url: 'https://discord.com/*' })
      .then((tabs) => {
        const tab = tabs[0];
        if (!tab || tab.id == null) {
          sendResponse({ ok: false, error: 'Open discord.com first' });
          return;
        }
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            func: () => {
              try {
                const raw = localStorage.getItem('token');
                if (!raw) return null;
                try {
                  return JSON.parse(raw);
                } catch (e) {
                  return raw.replace(/^"|"$/g, '');
                }
              } catch (e) {
                return null;
              }
            }
          })
          .then((results) => {
            const value = results && results[0] && results[0].result;
            if (typeof value === 'string' && value.length > 0) {
              sendResponse({ ok: true, token: value });
            } else {
              sendResponse({ ok: false, error: 'No token found — are you logged in?' });
            }
          })
          .catch((error) => {
            sendResponse({ ok: false, error: String((error && (error as Error).message) || error) });
          });
      })
      .catch(() => {
        sendResponse({ ok: false, error: 'Cannot find Discord tab' });
      });
    return true;
  }

  if (request.action === 'tokenLogin') {
    const raw = typeof request.token === 'string' ? request.token.trim() : '';
    const token = raw.replace(/^"+|"+$/g, '');
    if (!token) {
      sendResponse({ ok: false, error: 'Token is empty' });
      return false;
    }
    chrome.tabs
      .query({ url: 'https://discord.com/*' })
      .then((tabs) => {
        const tab = tabs[0];
        if (!tab || tab.id == null) {
          sendResponse({ ok: false, error: 'Open discord.com first' });
          return;
        }
        return chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: (t: string) => {
              try {
                const cookies = document.cookie.split(';');
                for (const c of cookies) {
                  const eq = c.indexOf('=');
                  const name = eq > -1 ? c.slice(0, eq).trim() : c.trim();
                  if (name) {
                    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
                  }
                }
              } catch (e) {
                /* ignore */
              }
              try {
                localStorage.setItem('token', JSON.stringify(t));
              } catch (e) {
                /* ignore */
              }
              location.reload();
            },
            args: [token]
          })
          .then(() => sendResponse({ ok: true }))
          .catch((error) => {
            sendResponse({ ok: false, error: String((error && (error as Error).message) || error) });
          });
      })
      .catch(() => {
        sendResponse({ ok: false, error: 'Cannot find Discord tab' });
      });
    return true;
  }

  if (request.action === 'executeQuestCode') {
    const now = Date.now();
    if (now - lastQuestCodeRunAt < 30000) {
      sendResponse({ success: true, skipped: true });
      return false;
    }
    lastQuestCodeRunAt = now;
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID found' });
      return false;
    }
    const manifest = chrome.runtime.getManifest();
    getConfig()
      .then((config) => {
        return chrome.scripting
          .executeScript({
            target: { tabId },
            func: (version: string, questConfig: unknown) => {
              (window as any).__QUEST_VERSION = version;
              (window as any).__QUEST_CONFIG__ = questConfig;
            },
            args: [manifest.version, config],
            world: 'MAIN'
          })
          .then(() => {
            return chrome.scripting.executeScript({
              target: { tabId },
              files: ['dist/quest-code.js'],
              world: 'MAIN'
            });
          });
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error injecting quest code:', error);
        const detail = String((error && (error as Error).message) || error || 'injection failed');
        sendResponse({ success: false, error: detail });
      });
    return true;
  }

  return false;
});
