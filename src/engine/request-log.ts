import { MESSAGE_PREFIX, type ApiEvent } from '../shared/messages';

function isApiRequest(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    return /(^|\.)(discord\.com|discordapp\.com)$/.test(u.hostname);
  } catch (error) {
    return url.includes('discord.com') || url.includes('discordapp.com');
  }
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function safeString(body: unknown): string {
  if (body == null) return '';
  try {
    return typeof body === 'string' ? body : JSON.stringify(body);
  } catch (error) {
    return String(body);
  }
}

let apiEventId = 0;

function emitApiEvent(method: string, url: string, status: number, reqBody: string, resBody: string): void {
  try {
    const evt: ApiEvent = {
      id: ++apiEventId,
      method,
      url: url.slice(0, 400),
      status,
      reqBody: clip(reqBody, 1200),
      resBody: clip(resBody, 2000),
      at: Date.now()
    };
    window.postMessage({ prefix: MESSAGE_PREFIX, type: 'API_EVENT', data: evt }, '*');
    if (/quest/i.test(url)) {
      console.info(`[Quest API] ${method} ${url} -> ${status}`, evt.reqBody ? `\n${evt.reqBody}` : '');
    }
  } catch (error) {
    /* ignore */
  }
}

export function installRequestLogger(): void {
  try {
    if ((window as any).__DQC_REQ_LOGGER__) return;
    (window as any).__DQC_REQ_LOGGER__ = true;

    const origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function (...args: any[]) {
        const input = args[0];
        const url = typeof input === 'string' ? input : input?.url || '';
        if (!isApiRequest(url)) return origFetch.apply(this, args as any);
        const init = args[1] || {};
        const method = String(init.method || (input?.method ?? 'GET')).toUpperCase();
        const reqBody = init.body != null ? safeString(init.body) : '';
        const res = origFetch.apply(this, args as any);
        res
          .then((r: Response) => {
            try {
              const status = r.status;
              r.clone()
                .text()
                .then((text) => emitApiEvent(method, url, status, reqBody, text))
                .catch(() => emitApiEvent(method, url, status, reqBody, ''));
            } catch (error) {
              /* ignore */
            }
          })
          .catch(() => {});
        return res;
      };
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (this: any, method: string, url: string, ...rest: any[]) {
      this.__dqc_method = String(method).toUpperCase();
      this.__dqc_url = String(url);
      return origOpen.apply(this, [method, url, ...rest] as any);
    };
    XMLHttpRequest.prototype.send = function (this: any, body?: any) {
      const url = this.__dqc_url || '';
      if (isApiRequest(url)) {
        const method = this.__dqc_method || 'GET';
        const reqBody = body != null ? safeString(body) : '';
        const onDone = () => {
          try {
            let resBody = '';
            try {
              resBody = safeString(this.responseText);
            } catch (error) {
              /* ignore */
            }
            emitApiEvent(method, url, this.status, reqBody, resBody);
          } catch (error) {
            /* ignore */
          }
          this.removeEventListener('loadend', onDone);
        };
        this.addEventListener('loadend', onDone);
      }
      return origSend.apply(this, [body] as any);
    };

    window.addEventListener('message', (event) => {
      try {
        const d = event.data;
        if (!d || typeof d !== 'object') return;
        const text = JSON.stringify(d);
        if (text.length > 2000) return;
        if (text.includes('DISCORD_QUEST_COMPLETER')) return;
        if (/quest(?!ion)/i.test(text)) {
          console.info(`[Quest SDK] ${text.slice(0, 1200)}`);
        }
      } catch (error) {
        /* ignore */
      }
    });
  } catch (error) {
    console.warn('Discord Auto Quest: request logger failed:', error);
  }
}
