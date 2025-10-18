/**
 * Test if API Logger is working
 * Run this in Chrome DevTools Console AFTER the page loads
 */

console.log('%c=== Testing API Logger ===', 'color: yellow; font-size: 16px; font-weight: bold;');

// Test 1: Check if fetch is overridden
console.log('1. Is fetch overridden?', window.fetch.toString().includes('originalFetch') || window.fetch.toString().includes('native'));

// Test 2: Make a test fetch request
console.log('2. Making test fetch request...');
fetch('/project/' + window.location.pathname.split('/')[2], {
  method: 'GET'
}).then(response => {
  console.log('✓ Test fetch completed:', response.status);
}).catch(error => {
  console.log('✗ Test fetch failed:', error.message);
});

// Test 3: Check if XHR is overridden
console.log('3. Is XMLHttpRequest overridden?', window.XMLHttpRequest.toString().includes('OriginalXHR') || window.XMLHttpRequest.toString().includes('native'));

// Test 4: Check if WebSocket is overridden
console.log('4. Is WebSocket overridden?', window.WebSocket.toString().includes('OriginalWebSocket') || window.WebSocket.toString().includes('native'));

console.log('\n%c=== If you see API Logger messages above, it\'s working! ===', 'color: lime; font-size: 14px; font-weight: bold;');
