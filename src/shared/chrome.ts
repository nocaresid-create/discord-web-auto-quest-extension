export function safeSendMessage(message: unknown, callback?: (response: unknown) => void): void {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      if (callback) {
        chrome.runtime.sendMessage(message, callback);
      } else {
        chrome.runtime.sendMessage(message);
      }
    } else if (callback) {
      callback(null);
    }
  } catch (e) {
    if (callback) {
      try {
        callback(null);
      } catch (e2) {
        /* ignore */
      }
    }
  }
}

export function readLastError(): unknown {
  try {
    return chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
  } catch (e) {
    return null;
  }
}
