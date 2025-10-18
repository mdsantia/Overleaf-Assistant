/**
 * Overleaf API Logger
 * Logs fetch, XHR, and WebSocket calls with essential details
 */

 (function() {
  'use strict';

  const logStyle = 'font-weight:bold;';
  const colors = {
    fetch: '#2196F3',
    xhr: '#FF9800',
    ws: '#9C27B0',
    success: '#4CAF50',
    error: '#F44336',
    info: '#9E9E9E',
    page: '#673AB7',
    export: '#009688',
  };

  let requestId = 0;
  const logs = [];

  // Utility logger
  function log(type, msg, data = null) {
    const color = colors[type] || '#000';
    console.log(`%c[API Logger] ${msg}`, `color: ${color}; ${logStyle}`);
    if (data) console.log(data);
  }

  // Generate full URL helper
  function fullUrl(url) {
    return url.startsWith('http') ? url : window.location.origin + url;
  }

  // Fetch override
  const originalFetch = window.fetch;
  window.fetch = async function(resource, config = {}) {
    const id = ++requestId;
    const method = (config.method || 'GET').toUpperCase();
    const url = typeof resource === 'string' ? resource : resource.url;

    log('fetch', `FETCH #${id} → ${method} ${url}`);

    const start = performance.now();
    try {
      const response = await originalFetch.apply(this, arguments);
      const duration = (performance.now() - start).toFixed(2);

      log('success', `FETCH #${id} ✓ ${response.status} (${duration}ms)`);
      const contentType = response.headers.get('content-type') || '';

      let preview = null;
      if (contentType.includes('application/json')) {
        try {
          const json = await response.clone().json();
          preview = JSON.stringify(json).slice(0, 100);
        } catch {}
      } else if (contentType.includes('text')) {
        try {
          const text = await response.clone().text();
          preview = text.slice(0, 100);
        } catch {}
      }

      logs.push({ id, type: 'fetch', method, url: fullUrl(url), status: response.status, duration, preview });
      return response;
    } catch (error) {
      log('error', `FETCH #${id} ✗ Error`, error);
      logs.push({ id, type: 'fetch', method, url: fullUrl(url), error: error.message });
      throw error;
    }
  };

  // XMLHttpRequest override
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    let id = 0, url = '', method = '';
    let start = 0;

    const open = xhr.open;
    xhr.open = function(m, u, ...args) {
      id = ++requestId; method = m.toUpperCase(); url = u;
      log('xhr', `XHR #${id} → ${method} ${url}`);
      return open.apply(this, [m, u, ...args]);
    };

    const send = xhr.send;
    xhr.send = function(body) {
      start = performance.now();
      if (body) log('xhr', `XHR #${id} request body:`, typeof body === 'string' ? body.slice(0, 100) : body);

      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          const duration = (performance.now() - start).toFixed(2);
          log(xhr.status >= 200 && xhr.status < 400 ? 'success' : 'error', `XHR #${id} ← ${xhr.status} (${duration}ms)`);

          let preview = null;
          try {
            if (xhr.responseText) {
              try {
                preview = JSON.stringify(JSON.parse(xhr.responseText)).slice(0, 100);
              } catch {
                preview = xhr.responseText.slice(0, 100);
              }
            }
          } catch {}

          logs.push({ id, type: 'xhr', method, url: fullUrl(url), status: xhr.status, duration, preview });
        }
      };

      return send.apply(this, arguments);
    };

    return xhr;
  };

  // WebSocket override
  const OriginalWS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const ws = new OriginalWS(url, protocols);
    let id = ++requestId;
    let msgCount = 0;

    log('ws', `WebSocket #${id} connected: ${url}`);

    const originalSend = ws.send;
    ws.send = function(data) {
      msgCount++;
      log('ws', `WS #${id} send #${msgCount}:`, data);
      return originalSend.call(this, data);
    };

    ws.addEventListener('message', e => {
      msgCount++;
      log('ws', `WS #${id} recv #${msgCount}:`, e.data);
    });

    ws.addEventListener('close', e => {
      log('ws', `WebSocket #${id} closed: code ${e.code} reason "${e.reason}"`);
    });

    ws.addEventListener('error', e => {
      log('error', `WebSocket #${id} error:`, e);
    });

    return ws;
  };

  // Export logs function
  window.exportApiLogs = function() {
    log('export', `Exporting ${logs.length} logs`);
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `overleaf-api-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Initial info
  log('info', `Page: ${window.location.href}`);

  // Extract project ID from URL if available
  const projectIdMatch = window.location.pathname.match(/\/project\/([^\/]+)/);
  if (projectIdMatch) log('info', `Project ID: ${projectIdMatch[1]}`);

  log('success', 'API Logger initialized');
})();
