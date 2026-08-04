<script lang="ts">
  import QuestButton from './QuestButton.svelte';
  import QuestPanel from './QuestPanel.svelte';
  import Toast from './Toast.svelte';
  import ApiInspector from './ApiInspector.svelte';
  import { questStore } from './questStore.svelte';

  let { onRun, onTogglePanel, onStop, onRefresh, onSkip, onClaim }: {
    onRun: () => void;
    onTogglePanel: () => void;
    onStop: () => void;
    onRefresh: () => void;
    onSkip: (id: string) => void;
    onClaim: (id: string) => void;
  } = $props();
</script>

<div class="root">
  <QuestButton {onRun} {onTogglePanel} />
  {#if questStore.expanded}
    <QuestPanel {onStop} {onRefresh} {onSkip} {onClaim} />
  {/if}
  <ApiInspector />
  <Toast />
</div>

<style>
  :global(#dqc-shadow-styles) {
    display: none;
  }
  :global(.root) {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
</style>
