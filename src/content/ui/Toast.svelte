<script lang="ts">
  import { fade } from 'svelte/transition';
  import { questStore } from './questStore.svelte';
</script>

{#if questStore.toast.visible}
  <div class="toast" transition:fade={{ duration: 200 }}>
    ✓ {questStore.toast.text}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 10001;
    background: linear-gradient(180deg, #2fc271 0%, #1f9e57 55%, #177a41 100%);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 12.5px;
    font-weight: 600;
    padding: 11px 15px;
    border-radius: 11px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.28),
      inset 0 -2px 5px rgba(0, 0, 0, 0.25),
      0 1px 0 rgba(255, 255, 255, 0.05),
      0 8px 20px rgba(0, 0, 0, 0.45),
      0 18px 44px rgba(35, 165, 89, 0.3);
    max-width: 300px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  }
</style>
