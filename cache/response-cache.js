// response-cache.js
// Generic offline response cache using chrome.storage.local

(function() {
  const CACHE_KEY = "res_cache";

  async function saveResponse(url, body, headers, status) {
    return new Promise(resolve => {
      chrome.storage.local.get(CACHE_KEY, (data) => {
        const cache = data[CACHE_KEY] || {};
        cache[url] = {
          savedAt: new Date().toISOString(),
          status,
          headers,
          body
        };
        chrome.storage.local.set({ [CACHE_KEY]: cache }, () => resolve());
      });
    });
  }

  async function getResponse(url) {
    return new Promise(resolve => {
      chrome.storage.local.get(CACHE_KEY, (data) => {
        const cache = data[CACHE_KEY] || {};
        resolve(cache[url] || null);
      });
    });
  }

  // Expose helpers
  window.responseCache = { saveResponse, getResponse };
})();
