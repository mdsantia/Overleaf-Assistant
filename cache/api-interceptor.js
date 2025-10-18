/**
 * API Interceptor for Overleaf
 * Intercepts fetch/XHR requests and serves cached data when offline
 * Includes extensive logging for debugging
 */

(function() {
  'use strict';

  console.log('%c[Interceptor] 🚀 Initializing API Interceptor...', 'color: #4CAF50; font-weight: bold;');

  let isOfflineMode = !navigator.onLine;
  let interceptStats = {
    totalRequests: 0,
    cachedResponses: 0,
    liveResponses: 0,
    failedRequests: 0
  };

  // Check initial offline mode from storage
  chrome.storage.local.get(['offlineMode'], (result) => {
    isOfflineMode = result.offlineMode || !navigator.onLine;
    console.log(`[Interceptor] 📡 Initial mode: ${isOfflineMode ? 'OFFLINE' : 'ONLINE'}`);
  });

  // Listen for offline/online status changes
  window.addEventListener('online', () => {
    isOfflineMode = false;
    console.log('%c[Interceptor] 🟢 ONLINE mode activated', 'color: #2E7D32; font-weight: bold;');
    console.log('[Interceptor] 📊 Stats:', interceptStats);
  });

  window.addEventListener('offline', () => {
    isOfflineMode = true;
    console.log('%c[Interceptor] 🔴 OFFLINE mode activated', 'color: #D32F2F; font-weight: bold;');
    console.log('[Interceptor] Will serve cached responses for intercepted requests');
  });

  /**
   * Override native fetch
   */
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [resource, config] = args;
    const url = typeof resource === 'string' ? resource : resource.url;
    const method = config?.method || 'GET';

    interceptStats.totalRequests++;

    console.groupCollapsed(`[Interceptor] 📤 Fetch Request #${interceptStats.totalRequests}: ${method} ${url}`);
    console.log('Method:', method);
    console.log('URL:', url);
    console.log('Config:', config);
    console.log('Offline Mode:', isOfflineMode);

    // Check if we should intercept this request
    if (shouldInterceptRequest(url)) {
      console.log('%c[Interceptor] ✓ Request matches interception pattern', 'color: #FF9800;');
      
      // Try to get cached response first if offline or if explicitly requested
      if (isOfflineMode || shouldUseCachedVersion(url)) {
        console.log('[Interceptor] 🔍 Checking cache...');
        const cachedResponse = await getCachedResponse(url, method, config?.headers);
        
        if (cachedResponse) {
          interceptStats.cachedResponses++;
          console.log('%c[Interceptor] ✅ Cache HIT! Serving cached response', 'color: #4CAF50; font-weight: bold;');
          console.log('Cached data:', cachedResponse.data);
          console.log('Cache timestamp:', new Date(cachedResponse.timestamp).toLocaleString());
          console.groupEnd();
          
          return new Response(JSON.stringify(cachedResponse.data), {
            status: cachedResponse.statusCode,
            statusText: 'OK',
            headers: { 
              'Content-Type': 'application/json',
              'X-Cached': 'true',
              'X-Cache-Timestamp': cachedResponse.timestamp
            }
          });
        } else if (isOfflineMode) {
          interceptStats.failedRequests++;
          console.warn('%c[Interceptor] ❌ Cache MISS! No cached data available in offline mode', 'color: #F44336; font-weight: bold;');
          console.groupEnd();
          
          return new Response(JSON.stringify({ error: 'Offline - no cached data' }), {
            status: 503,
            statusText: 'Service Unavailable'
          });
        } else {
          console.log('[Interceptor] ⚠️ Cache MISS - will fetch from server');
        }
      }

      // Online mode - make request and cache response
      try {
        console.log('[Interceptor] 🌐 Fetching from Overleaf server...');
        const startTime = performance.now();
        const response = await originalFetch.apply(this, args);
        const endTime = performance.now();
        
        interceptStats.liveResponses++;
        console.log(`%c[Interceptor] ✅ Server response received in ${(endTime - startTime).toFixed(2)}ms`, 'color: #2196F3; font-weight: bold;');
        console.log('Status:', response.status, response.statusText);
        console.log('Headers:', [...response.headers.entries()]);
        
        // Clone response to cache it
        const clonedResponse = response.clone();
        
        // Cache the response
        if (response.ok && method === 'GET') {
          console.log('[Interceptor] 💾 Caching response...');
          try {
            const data = await clonedResponse.json();
            console.log('Response data to cache:', data);
            
            const cached = await cacheApiResponse(url, method, config?.headers, data, response.status);
            if (cached) {
              console.log('%c[Interceptor] ✅ Response cached successfully', 'color: #4CAF50;');
            } else {
              console.warn('[Interceptor] ⚠️ Failed to cache response');
            }
          } catch (e) {
            console.error('[Interceptor] ❌ Error parsing/caching response:', e);
          }
        } else {
          console.log(`[Interceptor] ⏭️ Skipping cache (status: ${response.status}, method: ${method})`);
        }
        
        console.groupEnd();
        return response;
      } catch (error) {
        interceptStats.failedRequests++;
        console.error('%c[Interceptor] ❌ Fetch failed:', 'color: #F44336; font-weight: bold;', error.message);
        console.log('[Interceptor] 🔍 Attempting to serve cached fallback...');
        
        // Try to serve cached version if available
        const cachedResponse = await getCachedResponse(url, method, config?.headers);
        if (cachedResponse) {
          interceptStats.cachedResponses++;
          console.log('%c[Interceptor] ✅ Serving cached fallback', 'color: #FF9800; font-weight: bold;');
          console.groupEnd();
          
          return new Response(JSON.stringify(cachedResponse.data), {
            status: cachedResponse.statusCode,
            statusText: 'OK (Cached)',
            headers: { 
              'Content-Type': 'application/json',
              'X-Cached': 'true',
              'X-Fallback': 'true'
            }
          });
        }
        
        console.error('[Interceptor] ❌ No cached fallback available');
        console.groupEnd();
        throw error;
      }
    } else {
      console.log('[Interceptor] ⏭️ Request not intercepted - passing through');
      console.groupEnd();
    }

    // Not intercepting - pass through to original fetch
    return originalFetch.apply(this, args);
  };

  /**
   * Override XMLHttpRequest
   */
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    let requestUrl = '';
    let requestMethod = '';
    let requestId = Math.random().toString(36).substr(2, 9);

    xhr.open = function(method, url, ...args) {
      requestUrl = url;
      requestMethod = method;
      
      interceptStats.totalRequests++;
      console.groupCollapsed(`[Interceptor] 📤 XHR Request #${interceptStats.totalRequests} (${requestId}): ${method} ${url}`);
      console.log('Method:', method);
      console.log('URL:', url);
      console.log('Async:', args[0] !== false);
      console.log('Offline Mode:', isOfflineMode);
      
      return originalOpen.apply(this, [method, url, ...args]);
    };

    xhr.send = async function(...args) {
      if (shouldInterceptRequest(requestUrl)) {
        console.log('%c[Interceptor] ✓ XHR matches interception pattern', 'color: #FF9800;');
        
        if (isOfflineMode || shouldUseCachedVersion(requestUrl)) {
          console.log('[Interceptor] 🔍 Checking cache for XHR...');
          const cachedResponse = await getCachedResponse(requestUrl, requestMethod);
          
          if (cachedResponse) {
            interceptStats.cachedResponses++;
            console.log('%c[Interceptor] ✅ Cache HIT! Serving cached XHR response', 'color: #4CAF50; font-weight: bold;');
            console.log('Cached data:', cachedResponse.data);
            console.groupEnd();
            
            // Simulate successful response
            Object.defineProperty(xhr, 'readyState', { writable: true, value: 4 });
            Object.defineProperty(xhr, 'status', { writable: true, value: cachedResponse.statusCode });
            Object.defineProperty(xhr, 'statusText', { writable: true, value: 'OK' });
            Object.defineProperty(xhr, 'responseText', { writable: true, value: JSON.stringify(cachedResponse.data) });
            Object.defineProperty(xhr, 'response', { writable: true, value: JSON.stringify(cachedResponse.data) });
            
            // Trigger events
            setTimeout(() => {
              if (xhr.onreadystatechange) xhr.onreadystatechange();
              if (xhr.onload) xhr.onload();
            }, 0);
            
            return;
          } else if (isOfflineMode) {
            interceptStats.failedRequests++;
            console.warn('%c[Interceptor] ❌ Cache MISS! No cached XHR data in offline mode', 'color: #F44336; font-weight: bold;');
            console.groupEnd();
            
            // Simulate error response
            Object.defineProperty(xhr, 'readyState', { writable: true, value: 4 });
            Object.defineProperty(xhr, 'status', { writable: true, value: 503 });
            Object.defineProperty(xhr, 'statusText', { writable: true, value: 'Service Unavailable' });
            
            setTimeout(() => {
              if (xhr.onerror) xhr.onerror();
            }, 0);
            
            return;
          }
        }

        // Override onload to cache successful responses
        const originalOnLoad = xhr.onload;
        xhr.onload = function() {
          console.log(`[Interceptor] 🌐 XHR (${requestId}) response received`);
          console.log('Status:', xhr.status, xhr.statusText);
          
          if (xhr.status === 200 && requestMethod === 'GET') {
            console.log('[Interceptor] 💾 Caching XHR response...');
            try {
              const responseData = JSON.parse(xhr.responseText);
              console.log('XHR Response data:', responseData);
              
              cacheApiResponse(requestUrl, requestMethod, {}, responseData, xhr.status)
                .then(cached => {
                  if (cached) {
                    console.log('%c[Interceptor] ✅ XHR response cached successfully', 'color: #4CAF50;');
                  }
                  console.groupEnd();
                });
            } catch (e) {
              console.error('[Interceptor] ❌ Error parsing/caching XHR response:', e);
              console.groupEnd();
            }
          } else {
            console.log(`[Interceptor] ⏭️ Skipping XHR cache (status: ${xhr.status}, method: ${requestMethod})`);
            console.groupEnd();
          }
          
          if (originalOnLoad) originalOnLoad.apply(this, arguments);
        };
        
        const originalOnError = xhr.onerror;
        xhr.onerror = function() {
          interceptStats.failedRequests++;
          console.error(`%c[Interceptor] ❌ XHR (${requestId}) failed`, 'color: #F44336; font-weight: bold;');
          console.groupEnd();
          if (originalOnError) originalOnError.apply(this, arguments);
        };
      } else {
        console.log('[Interceptor] ⏭️ XHR not intercepted - passing through');
        console.groupEnd();
      }

      return originalSend.apply(this, args);
    };

    return xhr;
  };

  /**
   * Check if request should be intercepted
   */
  function shouldInterceptRequest(url) {
    if (!url) return false;
    
    const interceptPatterns = [
      /\/project\/[^\/]+\/file\//,
      /\/project\/[^\/]+\/doc\//,
      /\/project\/[^\/]+\/folder/,
      /\/project\/[^\/]+$/,
      /\/socket\.io/
    ];

    const shouldIntercept = interceptPatterns.some(pattern => pattern.test(url));
    
    if (shouldIntercept) {
      console.log(`[Interceptor] 🎯 URL matches pattern:`, url);
    }
    
    return shouldIntercept;
  }

  /**
   * Check if we should use cached version even when online
   */
  function shouldUseCachedVersion(url) {
    // For now, only use cache when offline
    // Could be extended to use cache for faster responses
    return false;
  }

  /**
   * Get cached response from storage
   */
  async function getCachedResponse(url, method, headers) {
    console.log('[Interceptor] 📞 Requesting cached response from background script...');
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'getCachedResponse',
        url,
        method,
        headers
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Interceptor] ❌ Error getting cached response:', chrome.runtime.lastError);
          resolve(null);
        } else {
          console.log('[Interceptor] 📬 Background script response:', response);
          resolve(response?.data || null);
        }
      });
    });
  }

  /**
   * Cache API response
   */
  async function cacheApiResponse(url, method, headers, data, statusCode) {
    console.log('[Interceptor] 📞 Sending cache request to background script...');
    console.log('Cache payload:', { url, method, dataSize: JSON.stringify(data).length, statusCode });
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'cacheApiResponse',
        url,
        method,
        headers,
        data,
        statusCode
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Interceptor] ❌ Error caching response:', chrome.runtime.lastError);
          resolve(false);
        } else {
          console.log('[Interceptor] 📬 Cache confirmation from background:', response);
          resolve(response?.success || false);
        }
      });
    });
  }

  // Log stats periodically
  setInterval(() => {
    if (interceptStats.totalRequests > 0) {
      console.log('%c[Interceptor] 📊 Statistics:', 'color: #9C27B0; font-weight: bold;', {
        total: interceptStats.totalRequests,
        cached: interceptStats.cachedResponses,
        live: interceptStats.liveResponses,
        failed: interceptStats.failedRequests,
        cacheHitRate: ((interceptStats.cachedResponses / interceptStats.totalRequests) * 100).toFixed(1) + '%'
      });
    }
  }, 30000); // Every 30 seconds

  console.log('%c[Interceptor] ✅ API interceptor initialized successfully', 'color: #4CAF50; font-weight: bold;');
  console.log('[Interceptor] 👀 Monitoring these patterns:', [
    '/project/*/file/*',
    '/project/*/doc/*',
    '/project/*/folder',
    '/project/*',
    '/socket.io'
  ]);
})();
