/**
 * API Logger Injector
 * This runs as a content script and injects the actual logger into the MAIN world
 * so it can intercept the page's WebSocket connections
 */

(function() {
  'use strict';

  console.log('[Injector] Injecting API logger into MAIN world...');

  // Inject the logger script into the page's context (MAIN world)
  const script = document.createElement('script');
  // script.src = chrome.runtime.getURL('cache/api-logger-main-world.js');
  script.onload = function() {
    console.log('[Injector] ✅ API logger injected successfully');
    this.remove();
  };
  script.onerror = function() {
    console.error('[Injector] ❌ Failed to inject API logger');
    this.remove();
  };
  
  // Inject as early as possible
  (document.head || document.documentElement).appendChild(script);
})();
