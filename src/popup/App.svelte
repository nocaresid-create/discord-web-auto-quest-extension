<script lang="ts">
  import { onMount } from 'svelte';
  import type { Settings } from '../shared/messages';

  let settings: Settings = {
    autoStart: true,
    autoAccept: true,
    notifications: true,
    concurrency: 2,
    stepSize: 1,
    autoRefresh: 0
  };
  let version = '?';
  let savedVisible = false;
  let savedTimer: ReturnType<typeof setTimeout> | null = null;

  const iconUrl = new URL('../../assets/icon.png', import.meta.url).href;

  onMount(() => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (resp: unknown) => {
      if (chrome.runtime.lastError) return;
      const r = resp as { settings?: Settings } | null;
      if (r && r.settings) settings = r.settings;
    });
    try {
      version = chrome.runtime.getManifest().version || '?';
    } catch (e) {
      version = '?';
    }
  });

  function save(): void {
    chrome.runtime.sendMessage({ action: 'saveSettings', settings }, (resp: unknown) => {
      if (chrome.runtime.lastError) return;
      const r = resp as { ok?: boolean } | null;
      if (!r || !r.ok) return;
      savedVisible = true;
      if (savedTimer !== null) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        savedVisible = false;
      }, 1500);
    });
  }

  function openQuestHome(): void {
    chrome.tabs.create({ url: 'https://discord.com/quest-home' });
  }

  let token = '';
  let tokenStatus = '';
  let tokenBusy = false;

  function copyCurrentToken(): void {
    tokenBusy = true;
    tokenStatus = 'Reading...';
    chrome.runtime.sendMessage({ action: 'getCurrentToken' }, (resp: unknown) => {
      tokenBusy = false;
      if (chrome.runtime.lastError) {
        tokenStatus = 'Extension error';
        return;
      }
      const r = resp as { ok?: boolean; token?: string; error?: string } | null;
      if (r && r.ok && r.token) {
        navigator.clipboard
          .writeText(r.token)
          .then(() => {
            tokenStatus = 'Current token copied';
          })
          .catch(() => {
            tokenStatus = 'Token read — copy failed (permissions)';
          });
      } else {
        tokenStatus = (r && r.error) || 'Failed';
      }
    });
  }

  function switchAccount(): void {
    const value = token.trim().replace(/^"+|"+$/g, '');
    if (!value) {
      tokenStatus = 'Paste a token first';
      return;
    }
    tokenBusy = true;
    tokenStatus = 'Switching...';
    chrome.runtime.sendMessage({ action: 'tokenLogin', token: value }, (resp: unknown) => {
      tokenBusy = false;
      if (chrome.runtime.lastError) {
        tokenStatus = 'Extension error';
        return;
      }
      const r = resp as { ok?: boolean; error?: string } | null;
      if (r && r.ok) {
        token = '';
        tokenStatus = 'Token set — Discord reloading';
      } else {
        tokenStatus = (r && r.error) || 'Failed';
      }
    });
  }
</script>

<div class="header">
  <div class="icon-tile">
    <img src={iconUrl} alt="icon" />
  </div>
  <div>
    <div class="title">Discord Auto Quest</div>
    <div class="sub">v{version}</div>
  </div>
</div>

<div class="section">
  <div class="section-label">Performance</div>
  <div class="row">
    <div>
      <div class="label">Concurrency</div>
      <div class="hint">Quests run in parallel (1-100)</div>
    </div>
    <input type="number" min="1" max="100" step="1" bind:value={settings.concurrency} />
  </div>
  <div class="row">
    <div>
      <div class="label">Auto re-check quests</div>
      <div class="hint">Rescan for new quests every X minutes</div>
    </div>
    <select bind:value={settings.autoRefresh}>
      <option value={0}>Off</option>
      <option value={5}>5 min</option>
      <option value={10}>10 min</option>
      <option value={15}>15 min</option>
    </select>
  </div>
</div>

<div class="section">
  <div class="section-label">Account</div>
  <div class="row">
    <div class="col">
      <div class="label">Switch account with token</div>
      <div class="hint">Paste your own Discord token, then Discord reloads</div>
    </div>
  </div>
  <input type="password" class="token-input" placeholder="Your token..." bind:value={token} />
  <div class="token-btns">
    <button class="token-btn" onclick={switchAccount} disabled={tokenBusy}>Switch account</button>
    <button class="token-btn" onclick={copyCurrentToken} disabled={tokenBusy}>Copy current token</button>
  </div>
  {#if tokenStatus}
    <div class="token-status">{tokenStatus}</div>
  {/if}
</div>

<div class="actions">
  <button class="ghost" onclick={openQuestHome}>Open quest-home</button>
  <button class="primary" onclick={save}>Save</button>
</div>
<div class="status" class:show={savedVisible}>Saved</div>
<div class="footer">All settings are stored locally in your browser</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    width: 300px;
    background:
      radial-gradient(120% 70% at 15% 0%, rgba(88, 101, 242, 0.17), transparent 55%),
      radial-gradient(120% 70% at 100% 100%, rgba(35, 165, 89, 0.09), transparent 55%),
      linear-gradient(180deg, #232531 0%, #191a20 100%);
    color: #f2f3f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    padding: 14px;
    font-size: 13px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 14px;
  }
  .icon-tile {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(139, 156, 248, 0.32), rgba(88, 101, 242, 0.16));
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      inset 0 -2px 5px rgba(0, 0, 0, 0.3),
      0 3px 8px rgba(88, 101, 242, 0.3),
      0 1px 0 rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .icon-tile img {
    width: 22px;
    height: 22px;
    border-radius: 6px;
  }
  .title {
    font-weight: 800;
    font-size: 14px;
    letter-spacing: -0.01em;
    background: linear-gradient(100deg, #f2f3f5 0%, #aab3ff 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .sub {
    color: #96989d;
    font-size: 11px;
    margin-top: 1px;
  }
  .section {
    margin-bottom: 12px;
  }
  .section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #8b91a0;
    margin: 0 2px 6px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(180deg, #272a33 0%, #202229 100%);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 10px;
    padding: 8px 11px;
    margin-bottom: 7px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 -2px 5px rgba(0, 0, 0, 0.2),
      0 1px 0 rgba(255, 255, 255, 0.04),
      0 3px 8px rgba(0, 0, 0, 0.32);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .row:hover {
    transform: translateY(-1px);
    border-color: rgba(139, 156, 248, 0.4);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.09),
      inset 0 -2px 5px rgba(0, 0, 0, 0.2),
      0 5px 12px rgba(0, 0, 0, 0.38),
      0 6px 16px rgba(88, 101, 242, 0.14);
  }
  .label {
    font-size: 12.5px;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .hint {
    font-size: 10px;
    color: #8b91a0;
    margin-top: 2px;
  }
  .switch {
    position: relative;
    width: 36px;
    height: 21px;
    flex-shrink: 0;
  }
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #3c404d 0%, #2a2d37 100%);
    border-radius: 11px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    cursor: pointer;
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.45),
      inset 0 -1px 0 rgba(255, 255, 255, 0.05),
      0 2px 5px rgba(0, 0, 0, 0.35);
    transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .slider::before {
    content: '';
    position: absolute;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: linear-gradient(180deg, #e3e7ef 0%, #aab0bd 100%);
    top: 2px;
    left: 2px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.65),
      inset 0 -2px 3px rgba(0, 0, 0, 0.25),
      0 1px 2px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  }
  .switch input:checked + .slider {
    background: linear-gradient(180deg, #7d88f2 0%, #5865f2 60%, #4650c7 100%);
    border-color: rgba(139, 156, 248, 0.55);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      inset 0 -2px 4px rgba(0, 0, 0, 0.25),
      0 2px 6px rgba(88, 101, 242, 0.4);
  }
  .switch input:checked + .slider::before {
    transform: translateX(15px);
    background: linear-gradient(180deg, #ffffff 0%, #dfe4f5 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.8),
      inset 0 -2px 3px rgba(0, 0, 0, 0.18),
      0 1px 3px rgba(0, 0, 0, 0.35);
  }
  select,
  input[type='number'] {
    width: 84px;
    background: linear-gradient(180deg, #17181d 0%, #20222a 100%);
    color: #f2f3f5;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 7px;
    padding: 5px 8px;
    font-size: 12.5px;
    outline: none;
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.4),
      0 1px 0 rgba(255, 255, 255, 0.05);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  select:focus,
  input[type='number']:focus {
    border-color: rgba(139, 156, 248, 0.6);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.4),
      0 0 0 2px rgba(88, 101, 242, 0.18);
  }
  .col {
    flex: 1;
    min-width: 0;
  }
  .token-input {
    width: 100%;
    background: linear-gradient(180deg, #17181d 0%, #20222a 100%);
    color: #f2f3f5;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 7px;
    padding: 8px 10px;
    font-size: 12px;
    font-family: 'SF Mono', Consolas, monospace;
    outline: none;
    margin-bottom: 7px;
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.4),
      0 1px 0 rgba(255, 255, 255, 0.05);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .token-input:focus {
    border-color: rgba(139, 156, 248, 0.6);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.4),
      0 0 0 2px rgba(88, 101, 242, 0.18);
  }
  .token-btn {
    flex: 1;
    background: linear-gradient(180deg, rgba(88, 101, 242, 0.35), rgba(88, 101, 242, 0.16));
    color: #f2f3f5;
    border: 1px solid rgba(139, 156, 248, 0.45);
    border-radius: 8px;
    padding: 8px 0;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      inset 0 -2px 4px rgba(0, 0, 0, 0.25),
      0 3px 8px rgba(88, 101, 242, 0.25);
    transition: transform 0.12s ease, filter 0.15s ease;
  }
  .token-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }
  .token-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .token-btns {
    display: flex;
    gap: 7px;
  }
  .token-status {
    margin-top: 7px;
    font-size: 11px;
    font-weight: 600;
    color: #58d68d;
    text-align: center;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .primary {
    flex: 1;
    background: linear-gradient(180deg, #6b76e8 0%, #5865f2 55%, #4852c9 100%);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 9px;
    padding: 9px 0;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      inset 0 -2px 4px rgba(0, 0, 0, 0.25),
      0 1px 0 rgba(255, 255, 255, 0.06),
      0 4px 10px rgba(88, 101, 242, 0.35);
    transition: transform 0.12s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }
  .primary:hover {
    transform: translateY(-1px);
    filter: brightness(1.07);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.28),
      inset 0 -2px 4px rgba(0, 0, 0, 0.25),
      0 6px 14px rgba(88, 101, 242, 0.45);
  }
  .primary:active {
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 5px rgba(0, 0, 0, 0.4),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .ghost {
    flex: 1;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03));
    color: #b5bac1;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 9px;
    padding: 9px 0;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.13),
      inset 0 -2px 3px rgba(0, 0, 0, 0.28),
      0 1px 0 rgba(255, 255, 255, 0.04),
      0 3px 7px rgba(0, 0, 0, 0.3);
    transition: transform 0.12s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .ghost:hover {
    transform: translateY(-1px);
    color: #f2f3f5;
    border-color: rgba(139, 156, 248, 0.5);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      inset 0 -2px 3px rgba(0, 0, 0, 0.28),
      0 5px 12px rgba(88, 101, 242, 0.2);
  }
  .ghost:active {
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.4),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .status {
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: #58d68d;
    height: 22px;
    margin-top: 8px;
    visibility: hidden;
  }
  .status.show {
    visibility: visible;
  }
  .footer {
    margin-top: 8px;
    padding-top: 9px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    text-align: center;
    font-size: 10.5px;
    color: #8b91a0;
  }
</style>
