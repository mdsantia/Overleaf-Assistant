// api-repeater.js
// Generic offline replay server in the browser for cached responses
(async function() {
    if (!window.responseCache) {
      console.error("responseCache not loaded");
      return;
    }
  
    // Example: intercept fetch for a custom offline demo
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function(url, config) {
      if (navigator.onLine) {
        // normal mode
        return originalFetch(url, config);
      }
  
      // offline mode: return cached version if available
      const cached = await window.responseCache.getResponse(url);
      if (cached) {
        console.log("[Offline Replayer] Serving cached:", url);
        return new Response(cached.body, {
          status: cached.status || 200,
          headers: cached.headers || { "content-type": "text/plain" }
        });
      }
  
      // fallback if no cache
      console.warn("[Offline Replayer] No cached response for:", url);
      return new Response("Offline cache miss", { status: 503 });
    };
  })();
  