import type { QuestConfig, QuestUpdate } from '../shared/messages';
import { MESSAGE_PREFIX } from '../shared/messages';
import { isWatchTask } from './tasks';
import { buildQuestState, featureName, setFeatureNameResolver, toQuestUpdate, type QuestState } from './quests';

interface Stores {
  QuestsStore: any;
  ChannelStore: any;
  GuildChannelStore: any;
  api: any;
}

const DEFAULT_CONFIG: QuestConfig = {
  concurrency: 2,
  autoAccept: true,
  video: { stepSize: 1, minDelay: 1000, maxDelay: 1500 },
  heartbeat: { minDelay: 20000, maxDelay: 22000 }
};

let webpackRequire: any = null;
let cancelled = false;
let poolRunning = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let lastQuestList: QuestUpdate[] = [];
const skipIds = new Set<string>();
const questMeta = new Map<string, { name: string; taskType: string; expiresAt: string | null }>();
const activeQuests = new Set<string>();

function loadQuestConfig(): QuestConfig {
  let injected: Partial<QuestConfig> = {};
  try {
    if ((window as any).__QUEST_CONFIG__) injected = (window as any).__QUEST_CONFIG__ || {};
    delete (window as any).__QUEST_CONFIG__;
    delete (window as any).__QUEST_VERSION;
  } catch (e) {
    /* ignore */
  }
  return {
    ...DEFAULT_CONFIG,
    ...injected,
    autoAccept: injected.autoAccept !== undefined ? injected.autoAccept : DEFAULT_CONFIG.autoAccept,
    video: { ...DEFAULT_CONFIG.video, ...(injected.video || {}) },
    heartbeat: { ...DEFAULT_CONFIG.heartbeat, ...(injected.heartbeat || {}) }
  };
}

function randomBetween(min: number, max?: number): number {
  return min + Math.random() * Math.max(0, (max || min) - min);
}

function sleep(min: number, max?: number): Promise<void> {
  return new Promise((r) => setTimeout(r, randomBetween(min || 0, max || min || 0)));
}

function waitForWebpack(callback: (require: any) => void): void {
  const checkInterval = 100;
  const maxAttempts = 100;
  let attempts = 0;

  const check = () => {
    if (attempts >= maxAttempts) return;

    if (typeof (window as any).webpackChunkdiscord_app === 'undefined') {
      attempts++;
      setTimeout(check, checkInterval);
      return;
    }

    try {
      const originalJQuery = (window as any).$;
      delete (window as any).$;

      const wr = (window as any).webpackChunkdiscord_app.push([
        [Symbol()],
        {},
        (require: any) => require
      ] as any);
      (window as any).webpackChunkdiscord_app.pop();

      if (originalJQuery) (window as any).$ = originalJQuery;

      if (!wr || !wr.c || Object.keys(wr.c).length < 10) {
        attempts++;
        setTimeout(check, checkInterval);
        return;
      }

      callback(wr);
    } catch (error) {
      attempts++;
      setTimeout(check, checkInterval);
    }
  };

  check();
}

function findModule(webpackRequire: any, filter: (exports: any) => boolean): any {
  for (const module of Object.values<any>(webpackRequire.c)) {
    if (module?.exports) {
      const exports = module.exports;
      if (exports.A && filter(exports.A)) return exports.A;
      if (exports.Ay && filter(exports.Ay)) return exports.Ay;
      if (exports.ZP && filter(exports.ZP)) return exports.ZP;
      if (filter(exports)) return exports;
    }
  }
  return null;
}

function sendUpdate(type: string, data: unknown): void {
  window.postMessage({ prefix: MESSAGE_PREFIX, type, data }, '*');
}

async function runPool(
  quests: QuestState[],
  concurrency: number,
  worker: (state: QuestState) => Promise<void>
): Promise<void> {
  const queue = [...quests];
  const limit = Math.max(1, concurrency || 1);
  const workers = [];
  for (let i = 0; i < limit; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0 && !cancelled) {
          const state = queue.shift();
          if (!state || state.completed || skipIds.has(state.quest.id)) continue;
          await worker(state);
        }
      })()
    );
  }
  await Promise.all(workers);
}

function collectQuestStates(QuestsStore: any): QuestState[] {
  const states: QuestState[] = [];
  for (const quest of QuestsStore.quests.values()) {
    const state = buildQuestState(quest);
    if (state) states.push(state);
  }
  return states;
}

function errorSummary(body: unknown): string {
  if (!body) return 'no response body';
  if (typeof body === 'string') return body.slice(0, 200);
  const b = body as { message?: unknown; code?: unknown };
  const msg = b.message || b.code;
  if (msg) return String(msg).slice(0, 200);
  return JSON.stringify(body).slice(0, 200);
}

const ENROLL_PAYLOADS: ReadonlyArray<{ label: string; body: unknown }> = [
  { label: 'location=11 (quest home)', body: { location: 11 } },
  { label: 'location=store', body: { location: 'store', source: 'quest_page' } },
  { label: 'empty', body: {} }
];

async function enrollQuest(api: any, id: string): Promise<{ ok: boolean; rateLimited: boolean; detail: string }> {
  let lastFail = { ok: false, rateLimited: false, detail: 'unknown error' };
  for (const attempt of ENROLL_PAYLOADS) {
    try {
      const res = await api.post({ url: `/quests/${id}/enroll`, body: attempt.body });
      if (res.status === 200 || res.status === 204) {
        return { ok: true, rateLimited: false, detail: errorSummary(res.body) };
      }
      if (res.status === 429) {
        const retryAfter = res.body && res.body.retry_after != null ? Math.ceil(res.body.retry_after) : 0;
        const detail = `rate limited (429)${retryAfter > 0 ? `, retry in ~${retryAfter}s` : ''}`;
        console.warn(`Discord Auto Quest: enroll for quest ${id} rate limited (429).`);
        sendUpdate('QUEST_RATE_LIMIT', {
          until: retryAfter > 0 ? Date.now() + retryAfter * 1000 : null,
          reason: 'rate limited by Discord'
        });
        return { ok: false, rateLimited: true, detail };
      }
      lastFail = {
        ok: false,
        rateLimited: false,
        detail: `HTTP ${res.status}: ${errorSummary(res.body)}`
      };
      console.warn(`Discord Auto Quest: enroll attempt "${attempt.label}" failed (${lastFail.detail})`);
    } catch (error) {
      const detail = error && error.message ? String(error.message) : String(error);
      console.warn(`Discord Auto Quest: enroll attempt "${attempt.label}" error: ${detail}`);
      lastFail = { ok: false, rateLimited: false, detail };
    }
  }
  return lastFail;
}

async function acceptQuest(stores: Stores, quest: any): Promise<'ok' | 'failed' | 'rate-limited'> {
  const name = quest.config?.messages?.questName ?? quest.id;
  console.info(`Discord Auto Quest: Accepting quest "${name}"...`);

  const result = await enrollQuest(stores.api, quest.id);
  if (result.ok) {
    sendUpdate('QUEST_RATE_LIMIT', { until: null, reason: '' });
    console.info(`Discord Auto Quest: Accepted "${name}".`);
    return 'ok';
  }
  sendUpdate('QUEST_ENROLL_RESULT', { name, ok: false, reason: result.detail });
  console.info(`Discord Auto Quest: "${name}" not accepted (${result.detail}).`);
  return result.rateLimited ? 'rate-limited' : 'failed';
}

function loadStores(wr: any): Stores | null {
  try {
    const QuestsStore = findModule(wr, (m) => m.__proto__?.getQuest);
    const ChannelStore = findModule(wr, (m) => m.__proto__?.getAllThreadsForParent);
    const GuildChannelStore = findModule(wr, (m) => m.getSFWDefaultChannel);
    const api = findModule(wr, (m) => m.Bo?.get || m.tn?.get);

    if (!QuestsStore || !api) return null;

    return { QuestsStore, ChannelStore, GuildChannelStore, api: api.Bo || api.tn || api };
  } catch (error) {
    return null;
  }
}

function findRunningGameStore(wr: any): any {
  try {
    return findModule(
      wr,
      (m) =>
        typeof m?.startGame === 'function' &&
        typeof m?.stopGame === 'function' &&
        typeof m?.getRunningGames === 'function'
    );
  } catch (error) {
    return null;
  }
}

const KNOWN_FEATURE_KEYS = [
  'SHAREABLE',
  'PLAY_ON_DESKTOP',
  'PLAY_ON_MOBILE',
  'WATCH_VIDEO',
  'CLOUD_GAMING_ACTIVITY',
  'CLOUD_GAMING_PROVIDER_NVIDIA',
  'CLOUD_GAMING_PROVIDER_GFN',
  'ACTIVITY_QUEST_AUTO_ENROLLMENT',
  'AUTO_ENROLLMENT',
  'QUESTS_CDN'
];

function buildFeatureResolver(wr: any): ((num: number) => string) | null {
  try {
    const modules = (wr as any)?.c || {};
    for (const key of Object.keys(modules)) {
      const exports = modules[key]?.exports;
      if (!exports || typeof exports !== 'object') continue;
      const candidates = [exports?.A, exports?.ZP, exports];
      for (const cand of candidates) {
        if (!cand || typeof cand !== 'object') continue;
        const keys = Object.keys(cand);
        if (keys.length < 5) continue;
        const known = keys.filter((k) => KNOWN_FEATURE_KEYS.includes(k));
        if (known.length < 2) continue;
        const map = new Map<number, string>();
        for (const k of keys) {
          if (typeof cand[k] === 'number') map.set(cand[k], k);
        }
        if (map.size === 0) continue;
        console.info(
          `Discord Auto Quest: Resolved ${map.size} quest feature name(s) from Discord bundle (${known.join(', ')})`
        );
        return (num: number) => map.get(num) ?? `f${num}`;
      }
    }
  } catch (error) {
    /* ignore */
  }
  return null;
}

function gameApplicationId(state: QuestState): string | null {
  try {
    const tasks = state.quest.config?.taskConfigV2?.tasks ?? state.quest.config?.taskConfig?.tasks;
    const task = tasks?.[state.taskType];
    const apps = task?.applications;
    const id = apps && apps.length > 0 ? apps[0].id : null;
    return id || null;
  } catch (error) {
    return null;
  }
}

function tryInjectGame(state: QuestState): { store: any; game: any } | null {
  try {
    const store = findRunningGameStore(webpackRequire);
    if (!store) return null;
    const appId = gameApplicationId(state);
    if (!appId) return null;
    const exe = `D:\\Games\\${state.questName.replace(/[^\w\s-]/g, '')}\\${appId}.exe`;
    const game = {
      id: '0',
      name: state.questName,
      processName: `${appId}.exe`,
      exePath: exe,
      executablePath: exe,
      applicationId: appId,
      isLaunchable: true,
      isRunning: true,
      isDetectedAsUnknown: false,
      lastLaunchedAt: Date.now()
    };
    store.startGame(game);
    console.info(`Discord Auto Quest: Injected fake running process for "${state.questName}" (app ${appId}).`);
    return { store, game };
  } catch (error) {
    console.warn('Discord Auto Quest: Game injection failed:', error);
    return null;
  }
}

function stopInjectedGame(injection: { store: any; game: any } | null): void {
  if (!injection) return;
  try {
    injection.store.stopGame(injection.game);
    console.info('Discord Auto Quest: Stopped fake running process.');
  } catch (error) {
    /* ignore */
  }
}

const notifyUI = (state: QuestState, progress: number, target: number, completed: boolean): void => {
  sendUpdate('QUEST_UPDATE', toQuestUpdate(state, activeQuests.has(state.id)));
};

function setActive(state: QuestState, active: boolean): void {
  if (active) activeQuests.add(state.id);
  else activeQuests.delete(state.id);
  sendUpdate('QUEST_ACTIVE', { id: state.id, name: state.questName, active });
}

async function processVideoStep(state: QuestState, api: any, config: QuestConfig): Promise<void> {
  const { id, secondsNeeded, currentProgress } = state;
  const speed = Math.max(1, config.video.stepSize || 1);

  const nextTime = Math.min(secondsNeeded, currentProgress + speed + Math.random());

  try {
    const res = await api.post({ url: `/quests/${id}/video-progress`, body: { timestamp: nextTime } });
    state.currentProgress = nextTime;
    notifyUI(state, Math.floor(state.currentProgress), secondsNeeded, false);

    if (res.body.completed_at !== null || state.currentProgress >= secondsNeeded) {
      state.completed = true;
      state.status = 'COMPLETED';
      notifyUI(state, secondsNeeded, secondsNeeded, true);
      await api.post({ url: `/quests/${id}/video-progress`, body: { timestamp: secondsNeeded } });
    }
  } catch (error) {
    /* ignore */
  }
}

async function processHeartbeatStep(state: QuestState, stores: Stores, config: QuestConfig): Promise<void> {
  const { api, ChannelStore, GuildChannelStore } = stores;
  const { id, taskType, secondsNeeded } = state;

  let channelId = ChannelStore?.getSortedPrivateChannels()[0]?.id;
  if (!channelId && GuildChannelStore) {
    const guilds = Object.values<any>(GuildChannelStore.getAllGuilds());
    const voice = guilds.find((g: any) => g?.VOCAL?.length > 0);
    if (voice) channelId = voice.VOCAL[0].channel.id;
  }

  const streamKey = channelId ? `call:${channelId}:1` : `call:${id}:1`;

  try {
    const response = await api.post({
      url: `/quests/${id}/heartbeat`,
      body: { stream_key: streamKey, terminal: false }
    });

    const serverProgress = response.body?.progress?.[taskType]?.value ?? 0;
    state.currentProgress = serverProgress;
    notifyUI(state, Math.floor(state.currentProgress), secondsNeeded, state.currentProgress >= secondsNeeded);

    if (state.currentProgress >= secondsNeeded) {
      await api.post({
        url: `/quests/${id}/heartbeat`,
        body: { stream_key: streamKey, terminal: true }
      });
      state.completed = true;
      state.status = 'COMPLETED';
      notifyUI(state, secondsNeeded, secondsNeeded, true);
    }
  } catch (error) {
    /* ignore */
  }
}

function makeWorker(stores: Stores, config: QuestConfig) {
  return async (state: QuestState): Promise<void> => {
    setActive(state, true);
    let injection: { store: any; game: any } | null = null;
    try {
      let consecutiveFails = 0;
      if (!isWatchTask(state.taskType)) {
        injection = tryInjectGame(state);
      }
      while (!state.completed && !cancelled && !skipIds.has(state.id)) {
        const isVideo = isWatchTask(state.taskType);
        const before = state.currentProgress;

        if (isVideo) {
          await processVideoStep(state, stores.api, config);
          if (!state.completed) await sleep(config.video.minDelay, config.video.maxDelay);
        } else {
          await processHeartbeatStep(state, stores, config);
          if (!state.completed) await sleep(config.heartbeat.minDelay, config.heartbeat.maxDelay);
        }

        if (state.currentProgress > before) {
          consecutiveFails = 0;
        } else {
          consecutiveFails++;
          if (consecutiveFails >= 5) {
            console.warn(`Discord Auto Quest: Skipping quest "${state.questName}" - no progress after 5 attempts`);
            break;
          }
          await sleep(2000 * consecutiveFails, 3000 * consecutiveFails);
        }
      }
    } finally {
      stopInjectedGame(injection);
      setActive(state, false);
    }
  };
}

function rememberMeta(questStates: QuestState[]): void {
  for (const state of questStates) {
    questMeta.set(state.id, {
      name: state.questName,
      taskType: state.taskType,
      expiresAt: state.expiresAt
    });
  }
}

function sendQuestList(questStates: QuestState[]): void {
  lastQuestList = questStates.map((s) => toQuestUpdate(s, activeQuests.has(s.id)));
  sendUpdate('QUEST_LIST', lastQuestList);
}

async function detectAndAccept(stores: Stores, config: QuestConfig): Promise<QuestState[]> {
  let questStates = collectQuestStates(stores.QuestsStore).filter((s) => !skipIds.has(s.id));

  if (questStates.length === 0) {
    console.info('Discord Auto Quest: No quests found. Accept quests on the quest-home page first.');
    return questStates;
  }

  const available = questStates.filter((s) => s.status === 'AVAILABLE');
  if (available.length > 0) {
    console.info(`Discord Auto Quest: Found ${available.length} available quest(s).`);
    if (config.autoAccept) {
      let blockedUntil = 0;
      try {
        const res = await stores.api.get({ url: '/quests/@me' });
        const until = res?.body?.quest_enrollment_blocked_until;
        if (until) blockedUntil = new Date(until).getTime();
      } catch (error) {
        /* ignore */
      }
      if (blockedUntil > Date.now()) {
        const when = new Date(blockedUntil).toLocaleTimeString();
        console.warn(`Discord Auto Quest: Quest enrollment is blocked by Discord until ${when} - skipping auto-accept.`);
        sendUpdate('QUEST_RATE_LIMIT', { until: blockedUntil, reason: 'enrollment blocked by Discord' });
        sendUpdate('QUEST_ENROLL_RESULT', { name: 'all', ok: false, reason: `enrollment blocked until ${when}` });
        return questStates;
      }

      console.info(`Discord Auto Quest: Auto-accepting ${available.length} quest(s)...`);
      let rateLimited = false;
      for (const state of available) {
        const outcome = await acceptQuest(stores, state.quest);
        if (outcome === 'rate-limited') {
          rateLimited = true;
          break;
        }
        await sleep(2000, 4000);
      }
      if (rateLimited) {
        console.warn('Discord Auto Quest: Stopped auto-accepting - Discord is rate limiting enrollment. Try again later.');
        return questStates;
      }
      await new Promise((r) => setTimeout(r, 2500));
      questStates = collectQuestStates(stores.QuestsStore).filter((s) => !skipIds.has(s.id));
      const stillAvailable = questStates.filter((s) => s.status === 'AVAILABLE').length;
      if (stillAvailable < available.length) {
        console.info(
          `Discord Auto Quest: ${available.length - stillAvailable}/${available.length} quest(s) accepted, ${stillAvailable} still available.`
        );
      }
    }
  }

  return questStates;
}

function pendingQuests(questStates: QuestState[]): QuestState[] {
  return questStates
    .filter((state) => state.runnable && state.status === 'RUNNING' && !state.completed)
    .sort(
      (a, b) =>
        new Date(a.expiresAt || 0).getTime() - new Date(b.expiresAt || 0).getTime()
    );
}

function dumpQuestConfigs(questStates: QuestState[]): void {
  for (const state of questStates) {
    try {
      const raw = state.quest.config as unknown;
      console.info(
        `[Quest Dump] ${state.questName} (${state.id})\nstatus=${state.status} taskType=${state.taskType} target=${state.secondsNeeded}` +
          (state.features.length > 0
            ? ` features=${state.features.map((f) => featureName(f)).join(' | ')}`
            : '') +
          `\n` +
          JSON.stringify(raw, null, 2)
      );
    } catch (error) {
      /* ignore */
    }
  }
}

async function runFlow(config: QuestConfig): Promise<void> {
  const stores = loadStores(webpackRequire);
  if (!stores) return;

  let questStates = await detectAndAccept(stores, config);
  rememberMeta(questStates);
  sendQuestList(questStates);
  dumpQuestConfigs(questStates);

  const pending = pendingQuests(questStates);

  if (pending.length === 0) {
    const remaining = questStates.filter((s) => s.status === 'AVAILABLE').length;
    const unsupported = questStates.filter((s) => s.status === 'UNSUPPORTED').length;
    if (remaining > 0) {
      console.info(`Discord Auto Quest: ${remaining} quest(s) still available (auto-accept may have failed - accept them manually).`);
    } else if (unsupported > 0) {
      console.info(`Discord Auto Quest: ${unsupported} quest(s) need manual completion (unsupported task type).`);
    } else {
      console.info("Discord Auto Quest: You don't have any uncompleted active quests!");
    }
    return;
  }

  cancelled = false;
  poolRunning = true;
  console.info(`Discord Auto Quest: Running ${pending.length} quest(s) with concurrency ${config.concurrency}`);

  try {
    await runPool(pending, config.concurrency, makeWorker(stores, config));
  } finally {
    poolRunning = false;
  }

  if (cancelled) {
    console.info('Discord Auto Quest: Stopped by user.');
    return;
  }

  const done = questStates.filter((s) => s.completed).length;
  console.info(`Discord Auto Quest: Finished. ${done}/${questStates.length} quest(s) completed.`);

  const unclaimed = questStates.filter((s) => s.completed && !s.claimed);
  if (unclaimed.length > 0) {
    console.info(`Discord Auto Quest: Claiming rewards for ${unclaimed.length} quest(s)...`);
    await claimCompleted(unclaimed);
  }

  scheduleAutoRefresh(config);
}

async function refresh(): Promise<void> {
  if (!webpackRequire) return;
  const config = loadQuestConfig();
  const stores = loadStores(webpackRequire);
  if (!stores) return;

  const questStates = await detectAndAccept(stores, config);
  rememberMeta(questStates);
  sendQuestList(questStates);

  if (poolRunning) {
    console.info('Discord Auto Quest: Quest pool already running, updated quest list only.');
    return;
  }

  const pending = pendingQuests(questStates);

  if (pending.length === 0) {
    console.info('Discord Auto Quest: Nothing to run - all quests done or still available.');
    scheduleAutoRefresh(config);
    return;
  }

  cancelled = false;
  poolRunning = true;
  console.info(`Discord Auto Quest: Refreshed - running ${pending.length} quest(s).`);
  try {
    await runPool(pending, config.concurrency, makeWorker(stores, config));
  } finally {
    poolRunning = false;
  }

  if (!cancelled) {
    const unclaimed = questStates.filter((s) => s.completed && !s.claimed);
    if (unclaimed.length > 0) await claimCompleted(unclaimed);
    scheduleAutoRefresh(config);
  }
}

function stop(): void {
  cancelled = true;
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  (window as unknown as { __QUEST_ENGINE_STARTED__?: boolean }).__QUEST_ENGINE_STARTED__ = false;
  console.info('Discord Auto Quest: Stop requested - finishing current steps...');
}

function scheduleAutoRefresh(config: QuestConfig): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  const minutes = Math.max(0, parseInt(String(config.autoRefreshMinutes ?? 0), 10) || 0);
  if (minutes <= 0) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refresh();
  }, minutes * 60000);
}

async function claimQuest(id: string): Promise<void> {
  if (!webpackRequire) return;
  let claimed = false;
  try {
    const actions = findModule(webpackRequire, (m) => m && typeof m.claimReward === 'function');
    if (actions && typeof actions.claimReward === 'function') {
      const result = actions.claimReward(id);
      if (result && typeof result.then === 'function') await result;
      claimed = true;
    }
    await new Promise((r) => setTimeout(r, 1500));
  } catch (error) {
    console.warn(`Discord Auto Quest: claimReward action failed for quest ${id}:`, error);
  }

  if (!claimed) {
    try {
      const stores = loadStores(webpackRequire);
      if (stores) {
        const res = await stores.api.post({
          url: `/quests/${id}/claim-reward`,
          body: { location: 11, platform: 0 }
        });
        claimed = res.status === 200 || res.status === 204;
        if (!claimed) {
          console.warn(`Discord Auto Quest: claim-reward failed for quest ${id} (status ${res.status}):`, res.body || res);
        }
      }
    } catch (error) {
      console.warn(`Discord Auto Quest: claim-reward request failed for quest ${id}:`, error);
    }
  }

  try {
    const stores = loadStores(webpackRequire);
    const quest = stores && stores.QuestsStore ? stores.QuestsStore.getQuest(id) : null;
    if (quest && quest.userStatus && quest.userStatus.claimedAt) {
      const meta = questMeta.get(id) ?? { name: '', taskType: '', expiresAt: null };
      const update: QuestUpdate = {
        id,
        name: meta.name || id,
        taskType: meta.taskType || 'UNKNOWN',
        progress: 0,
        target: 0,
        expiresAt: meta.expiresAt || null,
        status: 'CLAIMED',
        completed: true,
        claimed: true,
        active: false
      };
      sendUpdate('QUEST_UPDATE', update);
      console.info(`Discord Auto Quest: Reward claimed for "${meta.name || id}".`);
    } else if (claimed) {
      console.info(`Discord Auto Quest: Claim request sent for quest ${id} (waiting for store update).`);
    }
  } catch (error) {
    /* ignore */
  }
}

async function claimCompleted(questStates: QuestState[]): Promise<void> {
  for (const state of questStates) {
    if (state.completed && !state.claimed) {
      await claimQuest(state.id);
    }
  }
}

function skipQuest(id: string): void {
  if (!id) return;
  skipIds.add(id);
  const meta = questMeta.get(id);
  sendUpdate('QUEST_UPDATE', {
    id,
    name: meta ? meta.name : id,
    taskType: meta ? meta.taskType : 'UNKNOWN',
    progress: 0,
    target: 0,
    expiresAt: meta ? meta.expiresAt : null,
    status: 'SKIPPED',
    completed: false,
    claimed: false,
    active: false
  });
  console.info(`Discord Auto Quest: Quest ${meta ? `"${meta.name}"` : id} skipped.`);
}

window.addEventListener('message', ({ source, data }) => {
  if (source !== window || !data || data.prefix !== MESSAGE_PREFIX) return;
  if (data.type === 'QUEST_STOP') stop();
  else if (data.type === 'QUEST_REFRESH') refresh();
  else if (data.type === 'QUEST_GET_LIST') {
    if (lastQuestList.length > 0) sendUpdate('QUEST_LIST', lastQuestList);
  } else if (data.type === 'QUEST_SKIP' && data.data && data.data.id) skipQuest(data.data.id);
  else if (data.type === 'QUEST_CLAIM' && data.data && data.data.id) claimQuest(data.data.id);
});

function questCount(): number {
  try {
    const stores = loadStores(webpackRequire);
    if (!stores || !stores.QuestsStore || !stores.QuestsStore.quests) return 0;
    const q = stores.QuestsStore.quests;
    return q.size ?? q.length ?? 0;
  } catch (error) {
    return 0;
  }
}

async function runQuestCode(wr: any): Promise<void> {
  webpackRequire = wr;
  setFeatureNameResolver(buildFeatureResolver(wr));
  try {
    const config = loadQuestConfig();
    const version = config.version || 'unknown';
    console.info(`Discord Auto Quest: Initializing... (v${version})`);
    let prevCount = -1;
    let stableRuns = 0;
    let lastCount = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      lastCount = questCount();
      if (lastCount === prevCount) stableRuns++;
      else stableRuns = 0;
      prevCount = lastCount;
      if (attempt === 0 && lastCount === 0) {
        await runFlow(config);
      } else if (lastCount > 0 && stableRuns >= 1 && attempt >= 2) {
        await runFlow(config);
        break;
      } else if (attempt === 7) {
        await runFlow(config);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (lastCount === 0) {
      setTimeout(() => {
        if (!poolRunning) refresh();
      }, 8000);
    }
  } catch (error) {
    console.warn('Discord Auto Quest: engine error:', error);
  }
}

const engineGlobal = window as unknown as { __QUEST_ENGINE_STARTED__?: boolean };
if (engineGlobal.__QUEST_ENGINE_STARTED__) {
  console.info('Discord Auto Quest: Engine already running in this page, skipping duplicate start.');
} else {
  engineGlobal.__QUEST_ENGINE_STARTED__ = true;
  waitForWebpack(runQuestCode);
}
