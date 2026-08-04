<script lang="ts">
  import { apiStore, clearApiEvents, filteredEvents, toggleApiInspector } from './apiInspectorStore.svelte';

  let expandedId: number | null = null;

  let list = $derived(filteredEvents());

  function methodClass(method: string): string {
    return 'm-' + (method || 'GET').toLowerCase();
  }

  function statusClass(status: number): string {
    if (status >= 200 && status < 300) return 'st-ok';
    if (status >= 400) return 'st-err';
    return 'st-mid';
  }

  function toggle(e: { id: number }): void {
    expandedId = expandedId === e.id ? null : e.id;
  }
</script>

<button class="insp-toggle" title="API reader" onclick={toggleApiInspector}>
  <span class="dot {apiStore.events.length > 0 ? 'live' : ''}"></span>
  API
</button>

{#if apiStore.open}
  <div class="insp">
    <div class="insp-head">
      <span class="insp-title">API Reader</span>
      <span class="insp-count">{list.length}/{apiStore.events.length}</span>
    </div>
    <div class="insp-bar">
      <label class="qonly">
        <input type="checkbox" bind:checked={apiStore.questOnly} />
        quest only
      </label>
      <input class="search" type="text" placeholder="filter…" bind:value={apiStore.search} />
      <button class="clear" onclick={clearApiEvents} title="Clear">Clear</button>
    </div>
    <div class="insp-list">
      {#if list.length === 0}
        <div class="insp-empty">No API calls captured yet. Reload Discord if needed.</div>
      {/if}
      {#each list as evt (evt.id)}
        <div class="entry" class:open={expandedId === evt.id} onclick={() => toggle(evt)}>
          <div class="line">
            <span class="method {methodClass(evt.method)}">{evt.method}</span>
            <span class="path" title={evt.url}>{evt.url.replace(/^https?:\/\/[^/]+\/api\/v\d+\/?/i, '/api/')}</span>
            <span class="status {statusClass(evt.status)}">{evt.status}</span>
          </div>
          {#if expandedId === evt.id}
            <div class="detail">
              {#if evt.reqBody}
                <div class="block-label">req</div>
                <pre>{evt.reqBody}</pre>
              {/if}
              {#if evt.resBody}
                <div class="block-label">res</div>
                <pre>{evt.resBody}</pre>
              {/if}
              {#if !evt.reqBody && !evt.resBody}
                <pre>(no body)</pre>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .insp-toggle {
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 7px;
    background: linear-gradient(180deg, #2d303a 0%, #1c1e25 55%, #17181d 100%);
    color: #b5bac1;
    border: 1px solid #464c5c;
    border-radius: 12px;
    padding: 8px 13px;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.09),
      inset 0 -3px 6px rgba(0, 0, 0, 0.35),
      0 6px 14px rgba(0, 0, 0, 0.42);
    transition: border-color 0.15s ease, transform 0.12s ease;
  }
  .insp-toggle:hover {
    border-color: #6b76e8;
    transform: translateY(-1px);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3f4350;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.5);
  }
  .dot.live {
    background: #58d68d;
    box-shadow: 0 0 8px rgba(88, 214, 141, 0.7);
  }
  .insp {
    position: fixed;
    bottom: 66px;
    left: 20px;
    z-index: 9999;
    width: 430px;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(168deg, rgba(50, 53, 63, 0.97), rgba(24, 25, 31, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 10px 24px rgba(0, 0, 0, 0.5),
      0 28px 64px rgba(0, 0, 0, 0.6);
    color: #f2f3f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 12px;
    overflow: hidden;
  }
  .insp-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 6px;
  }
  .insp-title {
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 11px;
    color: #aab3ff;
  }
  .insp-count {
    font-size: 10px;
    color: #8b91a0;
  }
  .insp-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px 10px;
  }
  .qonly {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    color: #8b91a0;
    white-space: nowrap;
    cursor: pointer;
  }
  .qonly input {
    accent-color: #5865f2;
  }
  .search {
    flex: 1;
    min-width: 0;
    background: #17181d;
    color: #f2f3f5;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 7px;
    padding: 5px 8px;
    font-size: 11.5px;
    outline: none;
  }
  .search:focus {
    border-color: rgba(139, 156, 248, 0.6);
  }
  .clear {
    background: rgba(255, 255, 255, 0.07);
    color: #b5bac1;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 6px;
    padding: 4px 9px;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .clear:hover {
    color: #f23f43;
    border-color: rgba(242, 63, 67, 0.5);
  }
  .insp-list {
    overflow-y: auto;
    padding: 0 8px 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }
  .insp-empty {
    text-align: center;
    color: #8b91a0;
    font-size: 11px;
    padding: 22px 8px;
  }
  .entry {
    border-radius: 8px;
    margin-top: 6px;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
    overflow: hidden;
  }
  .entry.open {
    border-color: rgba(139, 156, 248, 0.45);
  }
  .line {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 9px;
  }
  .method {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 5px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .m-get {
    background: rgba(35, 165, 89, 0.25);
    color: #58d68d;
  }
  .m-post {
    background: rgba(88, 101, 242, 0.3);
    color: #aab3ff;
  }
  .m-put,
  .m-patch {
    background: rgba(240, 177, 50, 0.25);
    color: #ffcf6e;
  }
  .m-delete {
    background: rgba(242, 63, 67, 0.25);
    color: #ff7a7d;
  }
  .path {
    flex: 1;
    min-width: 0;
    font-family: SF Mono, Consolas, monospace;
    font-size: 10.5px;
    color: #b5bac1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status {
    font-size: 9.5px;
    font-weight: 800;
    padding: 2px 5px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .st-ok {
    background: rgba(35, 165, 89, 0.22);
    color: #58d68d;
  }
  .st-err {
    background: rgba(242, 63, 67, 0.25);
    color: #ff7a7d;
  }
  .st-mid {
    background: rgba(240, 177, 50, 0.22);
    color: #ffcf6e;
  }
  .detail {
    padding: 6px 9px 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .block-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #8b91a0;
    margin: 5px 0 3px;
  }
  pre {
    margin: 0;
    padding: 6px 8px;
    background: #101116;
    border-radius: 6px;
    font-family: SF Mono, Consolas, monospace;
    font-size: 10px;
    line-height: 1.45;
    color: #c9cdd6;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 180px;
    overflow-y: auto;
  }
</style>
