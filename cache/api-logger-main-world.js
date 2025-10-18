/**
 * Overleaf API Logger — FULL file
 * - Intercepts fetch, XMLHttpRequest, WebSocket
 * - Logs requests/responses without modifying or blocking application behavior
 * - Safe clones for fetch responses so original responses are returned to the page
 * - Exports logs to JSON and optionally forwards to chrome.runtime
 *
 * Usage:
 *  - Inject into page (content script or DevTools)
 *  - Call window.exportApiLogs() to download recorded events
 *
 * NOTE: Runs in MAIN world (intended to be injected into page, not a sandboxed context).
 */

 (function() {
  'use strict';

  // ---------- Config & State ----------
  console.log('%c[API Logger] 🚀 Starting Overleaf API Logger...', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
  console.log('[API Logger] Running in:', window === window.top ? 'MAIN WORLD ✓' : 'ISOLATED WORLD ✗');

  let requestCounter = 0;
  const requestLog = [];

  // Overleaf-ish endpoint patterns (adjust as needed)
  const overleafPatterns = {
    editingSession: /\/editingSession\/[^\/]+$/,
    createFolder: /\/project\/[^\/]+\/folder$/,
    createDoc: /\/project\/[^\/]+\/doc$/,
    moveDoc: /\/project\/[^\/]+\/doc\/[^\/]+\/move$/,
    renameEntity: /\/project\/[^\/]+\/(doc|folder|file)\/[^\/]+\/rename$/,
    deleteEntity: /\/project\/[^\/]+\/(doc|folder|file)\/[^\/]+$/,
    documentChange: /\/event\/document-/,
    projectInfo: /\/project\/[^\/]+$/
  };

  function identifyOverleafEndpoint(url) {
    if (!url) return null;
    for (const [name, pattern] of Object.entries(overleafPatterns)) {
      try {
        if (pattern.test(url)) return name;
      } catch (e) {
        // ignore pattern errors
      }
    }
    return null;
  }

  // Safe sanitizer for log entries (removes circulars and functions)
  function safeCloneForLog(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      // Fallback: shallow copy with primitives & stringified objects
      const out = {};
      for (const k in obj) {
        try {
          const v = obj[k];
          if (v === null) out[k] = null;
          else if (typeof v === 'object') out[k] = Array.isArray(v) ? v.slice(0, 20) : '[Object]';
          else if (typeof v === 'function') out[k] = '[Function]';
          else out[k] = v;
        } catch (_) {
          out[k] = '[Unserializable]';
        }
      }
      return out;
    }
  }

  // Forward log entry to extension background if available (non-fatal)
  function tryForwardToBackground(entry) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'overleaf-api-log', payload: entry }, () => {
          // ignore callback / errors
        });
      }
    } catch (e) {
      // no-op
    }
  }

  // ---------- Fetch hooking ----------
  (function patchFetch() {
    if (!window.fetch) {
      console.warn('[API Logger] fetch not available in this environment.');
      return;
    }

    const originalFetch = window.fetch.bind(window);

    window.fetch = async function(resource, config = {}) {
      const url = (typeof resource === 'string') ? resource : (resource && resource.url) || '';
      const method = (config && config.method) || 'GET';

      requestCounter++;
      const requestId = requestCounter;
      const timestamp = new Date().toISOString();
      const endpointType = identifyOverleafEndpoint(url);
      const isOverleafAPI = endpointType !== null;

      console.groupCollapsed(`%c[API Logger] 📤 FETCH #${requestId}${isOverleafAPI ? ' 🎯 OVERLEAF' : ''}`, 'font-weight:bold');
      console.log('[API Logger] Timestamp:', timestamp);
      console.log('[API Logger] Method:', method);
      console.log('[API Logger] URL:', url);
      console.log('[API Logger] Full URL:', url && url.startsWith('http') ? url : (window.location.origin + url));
      if (isOverleafAPI) console.log('%c[API Logger] 🎯 Endpoint Type: ' + endpointType, 'color: #FF9800; font-weight:bold');

      if (config) {
        try {
          const cfgSummary = {
            method: config.method,
            headers: config.headers,
            credentials: config.credentials,
            mode: config.mode
          };
          console.log('[API Logger] Config:', safeCloneForLog(cfgSummary));
        } catch (_) {}
        if (config.body) {
          try {
            if (typeof config.body === 'string') {
              try {
                console.log('[API Logger] 📦 Request Body (JSON):', JSON.parse(config.body));
              } catch {
                console.log('[API Logger] 📦 Request Body (Text):', config.body.substring ? config.body.substring(0, 2000) : String(config.body));
              }
            } else {
              console.log('[API Logger] 📦 Request Body (non-string):', config.body);
            }
          } catch (e) {
            console.log('[API Logger] 📦 Request Body (error reading):', e.message);
          }
        }
      }

      const logEntry = {
        id: requestId,
        timestamp,
        type: 'fetch',
        method,
        url,
        fullUrl: url && url.startsWith('http') ? url : (window.location.origin + url),
        endpointType: endpointType || undefined
      };

      try {
        const start = performance.now();
        const response = await originalFetch(resource, config);
        const end = performance.now();
        const duration = (end - start).toFixed(2);

        // Clone once for logging and read that clone. Return the original response unconsumed.
        let responseCloneForLog = null;
        try {
          responseCloneForLog = response.clone();
        } catch (e) {
          // clone may fail for opaque responses
          responseCloneForLog = null;
        }

        let contentType = null;
        let dataPreview = null;
        try {
          contentType = response.headers && response.headers.get ? response.headers.get('content-type') : null;
        } catch (e) {
          contentType = null;
        }

        if (responseCloneForLog) {
          try {
            if (contentType && contentType.includes('application/json')) {
              const json = await responseCloneForLog.json();
              dataPreview = JSON.stringify(json).substring(0, 2000);
              console.log('[API Logger] 📄 Response JSON Preview:', json);
            } else if (contentType && (contentType.includes('text') || contentType.includes('html'))) {
              const text = await responseCloneForLog.text();
              dataPreview = text.substring(0, 2000);
              console.log('[API Logger] 📄 Response Text Preview:', dataPreview);
            } else {
              // fallback to text where possible
              try {
                const text = await responseCloneForLog.text();
                dataPreview = text.substring(0, 2000);
                console.log('[API Logger] 📄 Response (unknown content-type) Text Preview:', dataPreview);
              } catch (e) {
                console.log('[API Logger] ⚠️ Response content not readable for logging:', e.message);
              }
            }
          } catch (e) {
            console.log('[API Logger] ⚠️ Error reading cloned response for log:', e.message);
          }
        } else {
          console.log('[API Logger] ⚠️ Could not clone response for logging (possibly opaque).');
        }

        console.log(`%c[API Logger] ✅ FETCH RESPONSE #${requestId} (${duration}ms)`, 'color: #4CAF50; font-weight:bold');
        console.log('[API Logger] Status:', response.status, response.statusText);
        if (response.headers && typeof response.headers.entries === 'function') {
          try {
            console.log('[API Logger] Headers:', Object.fromEntries(response.headers.entries()));
          } catch (e) {
            // ignore header serializing issues
          }
        }
        if (contentType) console.log('[API Logger] Content-Type:', contentType);
        console.groupEnd();

        logEntry.response = {
          status: response.status,
          statusText: response.statusText,
          duration,
          contentType,
          dataPreview
        };

        // store sanitized entry
        const sanitized = safeCloneForLog(logEntry);
        requestLog.push(sanitized);
        tryForwardToBackground(sanitized);

        // IMPORTANT: return the original response so page receives unconsumed stream
        return response;

      } catch (error) {
        console.groupEnd();
        console.log(`%c[API Logger] ❌ FETCH ERROR #${requestId}`, 'color: #F44336; font-weight:bold');
        console.error(error);

        logEntry.error = String(error && error.message ? error.message : error);
        const sanitized = safeCloneForLog(logEntry);
        requestLog.push(sanitized);
        tryForwardToBackground(sanitized);

        // Re-throw so normal app behavior occurs
        throw error;
      }
    };
  })();

  // ---------- XMLHttpRequest hooking ----------
  (function patchXHR() {
    const OriginalXHR = window.XMLHttpRequest;
    if (!OriginalXHR) {
      console.warn('[API Logger] XMLHttpRequest not available.');
      return;
    }

    window.XMLHttpRequest = function() {
      const xhr = new OriginalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;

      let requestUrl = '';
      let requestMethod = '';
      let requestId = 0;
      let timestamp = null;
      let bodyForLog = null;
      let startTime = 0;

      xhr.open = function(method, url, ...restArgs) {
        requestMethod = method;
        requestUrl = url || '';
        timestamp = new Date().toISOString();
        requestCounter++;
        requestId = requestCounter;
        console.groupCollapsed(`%c[API Logger] 📤 XHR #${requestId}`, 'font-weight:bold');
        console.log('[API Logger] Timestamp:', timestamp);
        console.log('[API Logger] Method:', method);
        console.log('[API Logger] URL:', requestUrl);
        console.log('[API Logger] Full URL:', requestUrl && requestUrl.startsWith('http') ? requestUrl : (window.location.origin + requestUrl));
        console.log('[API Logger] Async:', restArgs[0] !== false);

        // record initial log
        requestLog.push(safeCloneForLog({
          id: requestId,
          timestamp,
          type: 'xhr',
          method: requestMethod,
          url: requestUrl,
          fullUrl: requestUrl && requestUrl.startsWith('http') ? requestUrl : (window.location.origin + requestUrl)
        }));

        tryForwardToBackground({
          id: requestId,
          timestamp,
          type: 'xhr',
          method: requestMethod,
          url: requestUrl
        });

        return originalOpen.apply(xhr, [method, url, ...restArgs]);
      };

      xhr.send = function(...args) {
        startTime = performance.now();

        try {
          if (args && args[0]) {
            bodyForLog = args[0];
            if (typeof bodyForLog === 'string') {
              console.log('[API Logger] 📦 Request Body (string):', bodyForLog.substring(0, 2000));
            } else {
              // try to pretty-print FormData or objects
              try {
                if (bodyForLog instanceof FormData) {
                  const fd = {};
                  for (const pair of bodyForLog.entries()) {
                    fd[pair[0]] = (fd[pair[0]] ? fd[pair[0]] + ', ' : '') + String(pair[1]).substring(0, 200);
                  }
                  console.log('[API Logger] 📦 Request Body (FormData):', fd);
                } else {
                  console.log('[API Logger] 📦 Request Body (object):', safeCloneForLog(bodyForLog));
                }
              } catch (e) {
                console.log('[API Logger] 📦 Request Body (could not parse):', String(bodyForLog).substring(0, 400));
              }
            }
          }
        } catch (e) {
          console.log('[API Logger] ⚠️ Error logging XHR request body:', e.message);
        }

        const onReadyStateChangeOriginal = xhr.onreadystatechange;

        xhr.onreadystatechange = function() {
          try {
            if (xhr.readyState === 4) {
              const endTime = performance.now();
              const duration = (endTime - startTime).toFixed(2);

              console.groupCollapsed(`%c[API Logger] ✅ XHR RESPONSE #${requestId} (${duration}ms)`, 'color:#4CAF50;font-weight:bold');
              console.log('[API Logger] Status:', xhr.status, xhr.statusText);
              try {
                console.log('[API Logger] Response Headers:', xhr.getAllResponseHeaders());
              } catch (_) {}

              try {
                if (xhr.responseText) {
                  console.log('[API Logger] 📦 Response Text Length:', xhr.responseText.length, 'chars');

                  // Try parse JSON
                  try {
                    const jsonResponse = JSON.parse(xhr.responseText);
                    console.log('[API Logger] 📦 Response Data (JSON):', jsonResponse);
                    console.log('[API Logger] 🏗️ Response Structure:', Object.keys(jsonResponse));
                  } catch (e) {
                    // fallback to text snippet
                    console.log('[API Logger] 📄 Response Text (snippet):', xhr.responseText.substring(0, 1000));
                  }
                }
              } catch (e) {
                console.log('[API Logger] ⚠️ Error reading XHR responseText:', e.message);
              }

              console.groupEnd();

              // append sanitized log entry
              const entry = {
                id: requestId,
                timestamp,
                type: 'xhr',
                method: requestMethod,
                url: requestUrl,
                status: xhr.status,
                duration
              };
              requestLog.push(safeCloneForLog(entry));
              tryForwardToBackground(entry);
            }
          } catch (e) {
            // swallow errors to avoid interfering with page
            console.log('[API Logger] ⚠️ Error in xhr.onreadystatechange logger:', e.message);
          }

          if (typeof onReadyStateChangeOriginal === 'function') {
            try { onReadyStateChangeOriginal.apply(this, arguments); } catch (_) {}
          }
        };

        // preserve onerror
        const onErrorOriginal = xhr.onerror;
        xhr.onerror = function() {
          console.log(`%c[API Logger] ❌ XHR ERROR #${requestId}`, 'color: #F44336; font-weight:bold;');
          if (typeof onErrorOriginal === 'function') {
            try { onErrorOriginal.apply(this, arguments); } catch (_) {}
          }
        };

        return originalSend.apply(xhr, args);
      };

      // Return the modified xhr instance (it's still an instance of OriginalXHR)
      return xhr;
    };

    // Copy prototype to maintain identity checks (XMLHttpRequest.prototype)
    window.XMLHttpRequest.prototype = OriginalXHR.prototype;
  })();

  // ---------- WebSocket hooking ----------
  (function patchWebSocket() {
    const OriginalWebSocket = window.WebSocket;
    if (!OriginalWebSocket) {
      console.warn('[API Logger] WebSocket not available.');
      return;
    }

    window.WebSocket = function(url, protocols) {
      const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
      const createdAt = new Date().toISOString();
      const endpointType = identifyOverleafEndpoint(url);
      const isOverleafAPI = endpointType !== null;
      let messageCounter = 0;
      const socketId = ++requestCounter;

      console.groupCollapsed(`%c[API Logger] 🔌 WebSocket INIT #${socketId}${isOverleafAPI ? ' 🎯 OVERLEAF' : ''}`, 'font-weight:bold');
      console.log('[API Logger] URL:', url);
      console.log('[API Logger] Protocols:', protocols);
      console.log('[API Logger] Timestamp:', createdAt);
      if (isOverleafAPI) console.log('%c[API Logger] 🎯 Endpoint Type: ' + endpointType, 'color: #FF9800; font-weight:bold');
      console.groupEnd();

      // Patch send() to log outgoing messages without modifying data
      try {
        const originalSend = ws.send;
        ws.send = function(data) {
          messageCounter++;
          console.groupCollapsed(`%c[API Logger] 📤 WebSocket SEND #${messageCounter}`, 'font-weight:bold');
          console.log('[API Logger] Timestamp:', new Date().toISOString());
          console.log('[API Logger] Raw Data (first 2000 chars):', typeof data === 'string' ? data.substring(0, 2000) : data);
          // attempt to parse small JSON
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              console.log('[API Logger] Parsed JSON:', parsed);
            } catch (_) {}
          }
          console.groupEnd();

          // non-fatal background forward
          tryForwardToBackground({
            id: socketId,
            ts: new Date().toISOString(),
            type: 'ws-send',
            url,
            data: (typeof data === 'string' ? data.substring(0, 2000) : '[binary or object]')
          });

          return originalSend.call(this, data);
        };
      } catch (e) {
        // fail silently, do not break
      }

      // Listen for incoming messages so we can log them; do not interfere with original handlers
      try {
        ws.addEventListener('message', (event) => {
          messageCounter++;
          console.groupCollapsed(`%c[API Logger] 📨 WebSocket MESSAGE #${messageCounter}`, 'font-weight:bold');
          console.log('[API Logger] Timestamp:', new Date().toISOString());
          console.log('[API Logger] Raw Data (first 2000 chars):', typeof event.data === 'string' ? event.data.substring(0,2000) : event.data);

          if (typeof event.data === 'string') {
            try {
              const parsed = JSON.parse(event.data);
              console.log('[API Logger] Parsed JSON:', parsed);
            } catch (_) {}
          }

          console.groupEnd();

          tryForwardToBackground({
            id: socketId,
            ts: new Date().toISOString(),
            type: 'ws-message',
            url,
            dataPreview: typeof event.data === 'string' ? event.data.substring(0,2000) : '[binary]'
          });
        }, false);
      } catch (e) {
        // ignore
      }

      // Also patch close/error/open logging for visibility
      try {
        ws.addEventListener('open', () => {
          console.log('%c[API Logger] 🟢 WebSocket OPEN', 'color: #4CAF50; font-weight:bold;');
          console.log('[API Logger] URL:', url, 'Timestamp:', new Date().toISOString());
        }, false);

        ws.addEventListener('close', (event) => {
          console.log('%c[API Logger] 🔴 WebSocket CLOSE', 'color: #F44336; font-weight:bold;');
          console.log('[API Logger] Code:', event.code, 'Reason:', event.reason, 'WasClean:', event.wasClean);
        }, false);

        ws.addEventListener('error', (err) => {
          console.log('%c[API Logger] ❌ WebSocket ERROR', 'color: #F44336; font-weight:bold;');
          console.error(err);
        }, false);
      } catch (e) {
        // ignore
      }

      // Return the real ws instance — crucial so the page uses the original object
      return ws;
    };

    // keep the right prototype
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    try {
      // copy constants if any (some browsers rely on them)
      window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
      window.WebSocket.OPEN = OriginalWebSocket.OPEN;
      window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
      window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
    } catch (e) {
      // ignore
    }
  })();

  // ---------- Utility: export logs ----------
  window.exportApiLogs = function() {
    try {
      console.log('%c[API Logger] 📊 Request Log Summary', 'color: #009688; font-weight:bold;');
      console.log('[API Logger] Total requests:', requestLog.length);
      console.table(requestLog);

      const dataStr = JSON.stringify({ exportedAt: new Date().toISOString(), entries: requestLog }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overleaf-api-logs-${Date.now()}.json`;
      (document.body || document.documentElement).appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      console.log('[API Logger] ✅ Logs exported');
    } catch (e) {
      console.error('[API Logger] ❌ Failed to export logs:', e);
    }
  };

  // ---------- Page info ----------
  console.log('%c[API Logger] 📍 Page Information', 'color: #673AB7; font-weight:bold;');
  console.log('[API Logger] URL:', window.location.href);
  console.log('[API Logger] Origin:', window.location.origin);
  console.log('[API Logger] Pathname:', window.location.pathname);

  // Try to detect project id path for Overleaf
  try {
    const projectMatch = window.location.pathname.match(/\/project\/([^\/]+)/);
    if (projectMatch) {
      console.log('[API Logger] 🎯 Project ID:', projectMatch[1]);
    }
  } catch (e) {}

  console.log('%c[API Logger] ✅ Logger initialized successfully', 'color: #4CAF50; font-weight:bold;');
  console.log('[API Logger] 💡 Tip: Call window.exportApiLogs() to download logs');

})();
