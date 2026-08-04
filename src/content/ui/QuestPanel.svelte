<script lang="ts">
  import { COLORS } from '../../shared/constants';
  import { fmtElapsed } from '../../shared/format';
  import QuestItem from './QuestItem.svelte';
  import { counts, questStore } from './questStore.svelte';

  let { onStop, onRefresh, onSkip, onClaim }: {
    onStop: () => void;
    onRefresh: () => void;
    onSkip: (id: string) => void;
    onClaim: (id: string) => void;
  } = $props();

  let c = $derived(counts());

  let rlActive = $derived(
    questStore.rateLimit.until !== null && questStore.rateLimit.until > questStore.nowTs
  );

  let sessionLabel = $derived.by(() => {
    if (questStore.sessionStartTs)
      return `${questStore.sessionDone} done · ${fmtElapsed(questStore.nowTs - questStore.sessionStartTs)}`;
    if (questStore.sessionDone > 0) return `${questStore.sessionDone} done this session`;
    return '';
  });
</script>

<div class="panel">
  <div class="header">
    <span class="title">Quest Tracker</span>
  </div>

  {#if rlActive}
    <div class="rlimit" title={questStore.rateLimit.reason}>
      <span class="rlimit-dot"></span>
      <span class="rlimit-text">Rate limited — auto-accept paused</span>
      <b class="rlimit-time">{fmtElapsed(questStore.rateLimit.until! - questStore.nowTs)}</b>
    </div>
  {/if}

  <div class="stats">
    <span><b class="now">{c.active}</b> NOW</span>
    <span>·</span>
    <span><b>{c.queued}</b> QUEUED</span>
    <span>·</span>
    <span><b class="avail">{c.available}</b> AVAIL</span>
    <span>·</span>
    <span><b class="done">{c.done}</b> DONE</span>
  </div>

  <div class="list">
    {#each questStore.quests as quest (quest.id)}
      <QuestItem {quest} nowTs={questStore.nowTs} {onSkip} {onClaim} />
    {:else}
      <div class="empty">No quests yet — click "Running Quests" to get started.</div>
    {/each}
  </div>

  <div class="footer">
    <span class="credit">
      v{questStore.panelVersion} · by
      <a href="https://github.com/nvckai/Discord-Web-Auto-Quest-Extension" target="_blank" rel="noopener">NAN</a>
    </span>
    <span class="session">{sessionLabel}</span>
    <div class="actions">
      <button class="btn danger" onclick={onStop}>Stop</button>
      <button class="btn" onclick={onRefresh}>Refresh</button>
    </div>
  </div>
</div>

<style>
  .panel {
    position: fixed;
    bottom: 78px;
    right: 20px;
    z-index: 9999;
    background: linear-gradient(168deg, rgba(50, 53, 63, 0.96) 0%, rgba(33, 35, 42, 0.96) 45%, rgba(24, 25, 31, 0.97) 100%);
    backdrop-filter: blur(14px) saturate(1.35);
    -webkit-backdrop-filter: blur(14px) saturate(1.35);
    color: #f2f3f5;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 16px;
    width: 304px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -2px 8px rgba(0, 0, 0, 0.25),
      0 1px 0 rgba(255, 255, 255, 0.04),
      0 10px 24px rgba(0, 0, 0, 0.45),
      0 28px 64px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    animation: dqcPanelIn 0.18s ease-out;
    box-sizing: border-box;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: linear-gradient(100deg, #aab3ff 0%, #8b9cf8 40%, #aab3ff 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 2px 8px rgba(88, 101, 242, 0.35);
  }
  .rlimit {
    display: flex;
    align-items: center;
    gap: 7px;
    background: linear-gradient(180deg, rgba(242, 63, 67, 0.22), rgba(242, 63, 67, 0.07));
    border: 1px solid rgba(242, 63, 67, 0.45);
    border-radius: 10px;
    padding: 7px 10px;
    margin: -4px 0 10px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -2px 4px rgba(0, 0, 0, 0.22),
      0 3px 8px rgba(242, 63, 67, 0.18);
    animation: dqcRlimitIn 0.2s ease-out;
  }
  .rlimit-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f23f43;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 0 8px rgba(242, 63, 67, 0.8);
    flex-shrink: 0;
    animation: dqcBlink 1.2s ease-in-out infinite;
  }
  .rlimit-text {
    flex: 1;
    min-width: 0;
    font-size: 10.5px;
    font-weight: 600;
    color: #ff9b9d;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rlimit-time {
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    color: #ff7a7d;
    background: linear-gradient(180deg, rgba(242, 63, 67, 0.28), rgba(242, 63, 67, 0.1));
    border: 1px solid rgba(242, 63, 67, 0.4);
    border-radius: 6px;
    padding: 1px 7px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      0 2px 4px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }
  @keyframes dqcRlimitIn {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @keyframes dqcBlink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  .stats {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: #96989d;
    margin: 10px 0 12px;
  }
  .stats b {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.02));
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 7px;
    padding: 2px 7px;
    font-size: 11px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      0 2px 4px rgba(0, 0, 0, 0.35);
    color: #b5bac1;
  }
  .stats .now {
    color: #aab3ff;
    border-color: rgba(139, 156, 248, 0.35);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.14),
      0 2px 6px rgba(88, 101, 242, 0.3);
  }
  .stats .avail {
    color: #f0b132;
    border-color: rgba(240, 177, 50, 0.35);
  }
  .stats .done {
    color: #23a559;
    border-color: rgba(35, 165, 89, 0.35);
  }
  .list {
    margin-bottom: 10px;
    max-height: 260px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #3f4350 transparent;
  }
  .list::-webkit-scrollbar {
    width: 6px;
  }
  .list::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #454b5c, #333845);
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }
  .list::-webkit-scrollbar-track {
    background: transparent;
  }
  .empty {
    text-align: center;
    color: #96989d;
    font-size: 12px;
    padding: 28px 8px;
    line-height: 1.5;
  }
  .footer {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding-top: 11px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: #96989d;
    gap: 8px;
    flex-wrap: wrap;
  }
  .credit {
    font-size: 10px;
  }
  .credit a {
    color: #fff;
    font-weight: 700;
    text-decoration: none;
  }
  .session {
    font-size: 10px;
    color: #23a559;
    font-weight: 600;
    margin-left: auto;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #b5bac1;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 11px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.14),
      inset 0 -2px 3px rgba(0, 0, 0, 0.28),
      0 2px 5px rgba(0, 0, 0, 0.35);
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.1s ease;
  }
  .btn:hover {
    border-color: rgba(139, 156, 248, 0.55);
    color: #f2f3f5;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -2px 3px rgba(0, 0, 0, 0.28),
      0 3px 8px rgba(88, 101, 242, 0.3);
  }
  .btn:active {
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.4),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .btn.danger:hover {
    border-color: rgba(242, 63, 67, 0.6);
    color: #f23f43;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -2px 3px rgba(0, 0, 0, 0.28),
      0 3px 8px rgba(242, 63, 67, 0.3);
  }
  @keyframes dqcPanelIn {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
