<script lang="ts">
  import { formatRemaining } from '../../shared/format';
  import type { QuestUpdate } from '../../shared/messages';

  let {
    quest,
    nowTs,
    onSkip,
    onClaim
  }: {
    quest: QuestUpdate;
    nowTs: number;
    onSkip: (id: string) => void;
    onClaim: (id: string) => void;
  } = $props();

  let pct = $derived(
    quest.target > 0 ? Math.min(100, Math.round((quest.progress / quest.target) * 100)) : 0
  );

  let isAvailable = $derived(quest.status === 'AVAILABLE');
  let isSkipped = $derived(quest.status === 'SKIPPED');
  let isUnsupported = $derived(quest.status === 'UNSUPPORTED');
  let isClaimed = $derived(quest.status === 'CLAIMED' || (quest.completed && quest.claimed));
  let isActive = $derived(!!quest.active);
  let isDone = $derived(quest.completed);
  let showClaim = $derived(quest.status === 'COMPLETED' && !quest.claimed);

  let badgeClass = $derived(
    isAvailable
      ? 'badge-available'
      : isSkipped
        ? 'badge-skipped'
        : isUnsupported
          ? 'badge-unsupported'
          : isClaimed
            ? 'badge-claimed'
            : isDone
              ? 'badge-done'
              : isActive
                ? 'badge-running'
                : 'badge-queued'
  );

  let badgeText = $derived(
    isAvailable
      ? 'AVAILABLE'
      : isSkipped
        ? 'SKIPPED'
        : isUnsupported
          ? 'UNSUPPORTED'
          : isClaimed
            ? 'CLAIMED'
            : isDone
              ? 'DONE'
              : isActive
                ? 'RUNNING NOW'
                : 'QUEUED'
  );

  let fillWidth = $derived(
    isDone ? 100 : isAvailable || isSkipped || isUnsupported ? 0 : pct
  );

  let fillClass = $derived(
    isAvailable
      ? 'fill-available'
      : isSkipped || isUnsupported
        ? 'fill-idle'
        : isActive
          ? 'fill-active'
          : isDone
            ? 'fill-done'
            : ''
  );

  let progressText = $derived.by(() => {
    if (isAvailable) return 'Not accepted yet';
    if (isSkipped) return 'Skipped';
    if (isUnsupported) return 'Play manually in the app';
    if (isDone) {
      return isClaimed
        ? `${quest.progress}/${quest.target} sec · claimed`
        : `${quest.progress}/${quest.target} sec · 100%`;
    }
    return `${quest.progress}/${quest.target} sec · ${pct}%`;
  });

  let progressClass = $derived(
    isAvailable ? 'prog-available' : isSkipped ? 'prog-skipped' : isUnsupported ? 'prog-unsupported' : isDone ? 'prog-done' : isActive ? 'prog-active' : ''
  );

  let expiryText = $derived.by(() => {
    if (isDone) return isClaimed ? 'Claimed' : 'Completed';
    if (isSkipped) return 'Skipped';
    return formatRemaining(quest.expiresAt, nowTs);
  });

  let expiryClass = $derived.by(() => {
    if (isDone || isClaimed) return 'expiry-done';
    if (isSkipped) return 'expiry-skipped';
    const ms = quest.expiresAt ? new Date(quest.expiresAt).getTime() - nowTs : Infinity;
    if (ms <= 0) return 'expiry-expired';
    return ms <= 3600000 ? 'expiry-warn' : '';
  });

  let showDetails = $state(false);

  let durationText = $derived.by(() => {
    const s = quest.startsAt ? new Date(quest.startsAt) : null;
    const e = quest.expiresAt ? new Date(quest.expiresAt) : null;
    const f = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    if (s && e) return `${f(s)} - ${f(e)}`;
    return e ? f(e) : s ? f(s) : '—';
  });
</script>

<div
  class="item {isActive ? 'active' : ''} {isDone ? 'done' : ''} {isAvailable ? 'available' : ''} {isSkipped || isUnsupported || isDone ? 'dimmed' : ''}"
>
  <div class="top">
    <span class="name" title={quest.name}>{quest.name}</span>
    {#if showClaim}
      <button class="claim" onclick={() => onClaim(quest.id)}>Claim</button>
    {/if}
    <span class="badge {badgeClass}">{badgeText}</span>
    <button class="skip" title="Skip this quest" onclick={() => onSkip(quest.id)}>×</button>
  </div>
  <div class="type">{quest.taskType || 'UNKNOWN'}</div>
  {#if quest.features && quest.features.length > 0}
    <div class="feat">
      {#each quest.features as f}
        <span class="chip" title="quest feature">{f}</span>
      {/each}
    </div>
  {/if}
  {#if !isDone}
    <div class="track">
      <div class="fill {fillClass}" style="width: {fillWidth}%;"></div>
    </div>
  {/if}
  <div class="progress {progressClass}">{progressText}</div>
  <div class="expiry {expiryClass}">{expiryText}</div>
  <button class="dump-btn" onclick={() => (showDetails = !showDetails)}>
    {showDetails ? 'Hide' : 'Show'} config
  </button>
  {#if showDetails}
    <div class="dump">
      <div class="dl">Quest Info</div>
      <div class="kv"><span>ID</span><b title={quest.id}>{quest.id}</b></div>
      <div class="kv"><span>Duration</span><b>{durationText}</b></div>
      {#if quest.applications && quest.applications.length > 0}
        <div class="kv"><span>Application</span><b title={quest.applications.join(', ')}>{quest.applications.join(', ')}</b></div>
      {/if}
      <div class="dl">Tasks</div>
      <div class="kv"><span>{quest.taskType}</span><b>{quest.target} sec</b></div>
      <div class="kv"><span>Features</span><b>{quest.features && quest.features.length > 0 ? quest.features.join(', ') : '—'}</b></div>
      <div class="dl">Rewards</div>
      {#if quest.rewardName}
        <div class="kv"><span>Reward</span><b>{quest.rewardName}{quest.rewardAmount != null ? ` · ${quest.rewardAmount}` : ''}</b></div>
      {/if}
      <div class="kv"><span>SKU</span><b title={quest.rewardSku || ''}>{quest.rewardSku || '—'}</b></div>
      <div class="dl">Raw Config</div>
      {#if quest.configJson}
        <pre>{quest.configJson}</pre>
      {:else}
        <pre>(no config data)</pre>
      {/if}
    </div>
  {/if}
</div>

<style>
  .item {
    background: linear-gradient(180deg, #272a31 0%, #212329 100%);
    border: 1px solid #3a3f4c;
    border-radius: 12px;
    padding: 11px 12px;
    margin-bottom: 9px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.07),
      inset 0 -2px 6px rgba(0, 0, 0, 0.22),
      0 1px 0 rgba(255, 255, 255, 0.04),
      0 4px 10px rgba(0, 0, 0, 0.35);
    transition:
      opacity 0.3s ease,
      border-color 0.3s ease,
      box-shadow 0.3s ease,
      transform 0.18s ease;
  }
  .item:hover {
    transform: translateY(-2px);
    border-color: rgba(139, 156, 248, 0.5);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.09),
      inset 0 -2px 6px rgba(0, 0, 0, 0.22),
      0 8px 18px rgba(0, 0, 0, 0.45),
      0 14px 30px rgba(88, 101, 242, 0.16);
  }
  .item.active {
    border-color: rgba(139, 156, 248, 0.65);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.09),
      inset 0 -2px 6px rgba(0, 0, 0, 0.22),
      0 0 0 1px rgba(88, 101, 242, 0.28),
      0 4px 14px rgba(88, 101, 242, 0.28),
      0 10px 26px rgba(88, 101, 242, 0.16);
  }
  .item.done {
    border-color: rgba(35, 165, 89, 0.4);
  }
  .item.available {
    border-color: rgba(240, 177, 50, 0.4);
  }
  .item.dimmed {
    opacity: 0.6;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .name {
    flex: 1;
    font-size: 12.5px;
    font-weight: 600;
    color: #f2f3f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  .badge {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 3px 8px;
    border-radius: 999px;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      inset 0 -2px 3px rgba(0, 0, 0, 0.28),
      0 2px 5px rgba(0, 0, 0, 0.3);
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.4);
  }
  .badge-available {
    background: linear-gradient(180deg, rgba(240, 177, 50, 0.28), rgba(240, 177, 50, 0.1));
    color: #ffcf6e;
  }
  .badge-skipped {
    background: linear-gradient(180deg, rgba(120, 126, 140, 0.28), rgba(89, 92, 101, 0.1));
    color: #b5bac1;
  }
  .badge-unsupported {
    background: linear-gradient(180deg, rgba(242, 63, 67, 0.26), rgba(242, 63, 67, 0.08));
    color: #ff7a7d;
  }
  .badge-claimed {
    background: linear-gradient(180deg, #2fc271, #1c8a4c);
    color: #fff;
  }
  .badge-done {
    background: linear-gradient(180deg, rgba(35, 165, 89, 0.26), rgba(35, 165, 89, 0.08));
    color: #58d68d;
  }
  .badge-running {
    background: linear-gradient(180deg, #6b76e8, #4b55c9);
    color: #fff;
    animation: dqcPulse 1.4s ease-in-out infinite;
  }
  .badge-queued {
    background: linear-gradient(180deg, rgba(88, 101, 242, 0.28), rgba(88, 101, 242, 0.1));
    color: #aab3ff;
  }
  .claim {
    background: linear-gradient(180deg, rgba(35, 165, 89, 0.24), rgba(35, 165, 89, 0.08));
    border: 1px solid rgba(35, 165, 89, 0.55);
    border-radius: 8px;
    color: #58d68d;
    cursor: pointer;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 9px;
    flex-shrink: 0;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      inset 0 -2px 3px rgba(0, 0, 0, 0.25),
      0 2px 5px rgba(0, 0, 0, 0.3);
    transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
  }
  .claim:hover {
    background: linear-gradient(180deg, #2fc271, #1c8a4c);
    color: #fff;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      inset 0 -2px 3px rgba(0, 0, 0, 0.25),
      0 3px 8px rgba(35, 165, 89, 0.35);
  }
  .claim:active {
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.4),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .skip {
    background: transparent;
    border: none;
    color: #96989d;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 2px 3px;
    border-radius: 4px;
    flex-shrink: 0;
    opacity: 0.7;
    transition: color 0.15s ease, opacity 0.15s ease, transform 0.1s ease;
  }
  .skip:hover {
    color: #f23f43;
    opacity: 1;
    transform: translateY(-1px);
  }
  .type {
    font-size: 9.5px;
    color: #8b91a0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 7px;
  }
  .feat {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 7px;
  }
  .chip {
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 2px 6px;
    border-radius: 5px;
    background: rgba(88, 101, 242, 0.14);
    border: 1px solid rgba(139, 156, 248, 0.28);
    color: #aab3ff;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .track {
    height: 7px;
    background: linear-gradient(180deg, #191a1f, #23252c);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 7px;
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.5),
      0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .fill {
    height: 100%;
    background: linear-gradient(180deg, #7d88f2 0%, #5865f2 55%, #4650c7 100%);
    border-radius: 3px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      inset 0 -2px 3px rgba(0, 0, 0, 0.25);
    transition: width 0.4s ease, background-color 0.3s ease;
  }
  .fill-available {
    background: linear-gradient(180deg, #ffd271 0%, #f0b132 55%, #c68d1d 100%);
  }
  .fill-idle {
    background: linear-gradient(180deg, #4a4f5c, #333845);
  }
  .fill-active {
    background: linear-gradient(180deg, #8b9cf8 0%, #5865f2 55%, #4650c7 100%);
    background-size: 200% 100%;
    animation: dqcBarActive 1.6s linear infinite;
  }
  .fill-done {
    background: linear-gradient(180deg, #3dd681 0%, #23a559 55%, #17773d 100%);
  }
  .progress {
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 11px;
    color: #96989d;
  }
  .prog-available {
    color: #f0b132;
  }
  .prog-skipped {
    color: #b5bac1;
  }
  .prog-unsupported {
    color: #f23f43;
  }
  .prog-done {
    color: #23a559;
  }
  .prog-active {
    color: #aab3ff;
  }
  .expiry {
    font-size: 10px;
    color: #96989d;
    margin-top: 4px;
  }
  .expiry-done {
    color: #23a559;
  }
  .expiry-skipped {
    color: #b5bac1;
  }
  .expiry-warn {
    color: #f0b132;
  }
  .expiry-expired {
    color: #f23f43;
  }
  .dump-btn {
    margin-top: 8px;
    width: 100%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    color: #96989d;
    cursor: pointer;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 5px 0;
    transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }
  .dump-btn:hover {
    color: #aab3ff;
    border-color: rgba(139, 156, 248, 0.45);
    background: linear-gradient(180deg, rgba(88, 101, 242, 0.14), rgba(88, 101, 242, 0.05));
  }
  .dump {
    margin-top: 8px;
    border-top: 1px dashed rgba(255, 255, 255, 0.12);
    padding-top: 8px;
  }
  .dump-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 9.5px;
    color: #8b91a0;
    margin-bottom: 6px;
    font-family: 'SF Mono', Consolas, monospace;
    word-break: break-all;
  }
  .dl {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #aab3ff;
    margin: 7px 0 3px;
  }
  .dl:first-child {
    margin-top: 0;
  }
  .kv {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    font-size: 9.5px;
    color: #8b91a0;
    margin-bottom: 2px;
    font-family: 'SF Mono', Consolas, monospace;
  }
  .kv span {
    flex-shrink: 0;
  }
  .kv b {
    font-weight: 600;
    color: #c9cdd6;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .dump pre {
    margin: 0;
    padding: 7px 8px;
    background: #101116;
    border-radius: 7px;
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 9px;
    line-height: 1.45;
    color: #c9cdd6;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 220px;
    overflow-y: auto;
  }
  @keyframes dqcPulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.65;
    }
  }
  @keyframes dqcBarActive {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: 200% 50%;
    }
  }
</style>
