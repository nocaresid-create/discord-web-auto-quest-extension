<script lang="ts">
  import { COLORS } from '../../shared/constants';
  import { fmtElapsed } from '../../shared/format';
  import { counts, questStore } from './questStore.svelte';

  let { onRun, onTogglePanel }: { onRun: () => void; onTogglePanel: () => void } = $props();

  let c = $derived(counts());
  let flash = $derived(questStore.buttonFlash);
  let rlActive = $derived(
    questStore.rateLimit.until !== null && questStore.rateLimit.until > questStore.nowTs
  );

  let subLabel = $derived.by(() => {
    if (flash) return '';
    if (rlActive)
      return `Rate limited · retry in ${fmtElapsed(questStore.rateLimit.until! - questStore.nowTs)}`;
    if (c.total === 0) return 'Click to start';
    if (c.active > 0) return `${c.active} running now`;
    if (c.available > 0) return `${c.done}/${c.total} completed · ${c.available} available`;
    return `${c.done}/${c.total} completed`;
  });

  let isGlowing = $derived(c.active > 0);
</script>

<button
  class="btn {flash ? 'flash' : ''}"
  style="border-color: {flash ? flash.color : isGlowing ? COLORS.blurple : COLORS.borderSoft};"
  title="Run all quests"
  onclick={onRun}
>
  <span class="icon-wrap">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#aab3ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 12v10H4V12" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
    </svg>
  </span>
  <span class="text-wrap">
    <span class="text">{flash ? flash.message : 'Running Quests'}</span>
    <span class="sub {rlActive ? 'ratelimited' : ''}">{subLabel}</span>
  </span>
  <span
    class="expand {questStore.expanded ? 'rotated' : ''}"
    title="Toggle quest panel"
    role="button"
    tabindex="0"
    aria-label="Toggle quest panel"
    onclick={(e) => {
      e.stopPropagation();
      onTogglePanel();
    }}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onTogglePanel();
      }
    }}
  >
    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
</button>

<style>
  .btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    background: linear-gradient(180deg, #2d303a 0%, #1c1e25 55%, #17181d 100%);
    color: #f2f3f5;
    border: 1px solid #464c5c;
    border-radius: 14px;
    padding: 9px 10px 9px 12px;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.09),
      inset 0 -3px 6px rgba(0, 0, 0, 0.35),
      0 1px 0 rgba(255, 255, 255, 0.05),
      0 6px 14px rgba(0, 0, 0, 0.42),
      0 14px 34px rgba(0, 0, 0, 0.3);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.12s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    align-items: center;
    gap: 9px;
    width: 216px;
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
  }
  .btn:hover {
    border-color: #6b76e8;
    transform: translateY(-1px);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -3px 6px rgba(0, 0, 0, 0.35),
      0 1px 0 rgba(255, 255, 255, 0.05),
      0 8px 18px rgba(0, 0, 0, 0.45),
      0 16px 40px rgba(88, 101, 242, 0.28);
  }
  .btn:active {
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.45),
      inset 0 -1px 0 rgba(255, 255, 255, 0.04),
      0 2px 6px rgba(0, 0, 0, 0.4);
  }
  .btn.flash {
    animation: dqcGlow 1.4s ease-in-out infinite;
  }
  .icon-wrap {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 9px;
    background: linear-gradient(180deg, rgba(139, 156, 248, 0.28), rgba(88, 101, 242, 0.14));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -2px 4px rgba(0, 0, 0, 0.3),
      0 2px 6px rgba(88, 101, 242, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }
  .text-wrap {
    flex: 1;
    min-width: 0;
    line-height: 1.3;
  }
  .text {
    display: block;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #f2f3f5;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .sub {
    display: block;
    font-size: 11px;
    font-weight: 400;
    color: #9aa0ad;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }
  .sub.ratelimited {
    color: #ff7a7d;
    font-weight: 600;
  }
  .expand {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03));
    border: 1px solid #464c5c;
    border-radius: 8px;
    color: #96989d;
    cursor: pointer;
    font-size: 12px;
    width: 26px;
    height: 26px;
    margin-left: 2px;
    transition:
      transform 0.25s ease,
      background 0.15s ease,
      color 0.15s ease,
      box-shadow 0.15s ease;
    transform: rotate(0deg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      inset 0 -2px 3px rgba(0, 0, 0, 0.3),
      0 2px 4px rgba(0, 0, 0, 0.3);
  }
  .expand:hover {
    background: linear-gradient(180deg, rgba(139, 156, 248, 0.3), rgba(88, 101, 242, 0.12));
    color: #f2f3f5;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -2px 3px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(88, 101, 242, 0.35);
  }
  .expand:active {
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.45),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }
  .expand.rotated {
    transform: rotate(180deg);
  }
  .chevron {
    width: 10px;
    height: 10px;
    display: block;
    pointer-events: none;
    opacity: 0.85;
  }
  @keyframes dqcGlow {
    0%,
    100% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.09),
        inset 0 -3px 6px rgba(0, 0, 0, 0.35),
        0 6px 14px rgba(0, 0, 0, 0.42),
        0 14px 34px rgba(0, 0, 0, 0.3);
    }
    50% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.09),
        inset 0 -3px 6px rgba(0, 0, 0, 0.35),
        0 8px 18px rgba(0, 0, 0, 0.45),
        0 18px 44px rgba(88, 101, 242, 0.45);
    }
  }
</style>
