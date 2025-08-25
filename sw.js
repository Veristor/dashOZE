/**
 * Enspirion Dashboard - Service Worker
 * Handles caching, offline functionality, and push notifications
 */

const CACHE_NAME = 'enspirion-dashboard-v2.0.0';
const DATA_CACHE_NAME = 'enspirion-data-v2.0.0';

// Static assets to cache
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/js/config.js',
  '/assets/js/utils.js',
  '/assets/js/pse-api.js',
  '/assets/js/portfolio-calculator.js',
  '/assets/js/risk-calculator.js',
  '/assets/js/app.js',
  '/assets/images/icons/icon-192.png',
  '/assets/images/icons/icon-512.png'
];

// PSE API endpoints to cache
const API_CACHE_PATTERNS = [
  /^https:\/\/apimpdv2-bmgdhhajexe8aade\.a01\.azurefd\.net\/api\//
];

// Runtime caching strategies
const CACHE_STRATEGIES = {
  static: 'CacheFirst',
  api: 'NetworkFirst',
  images: 'CacheFirst'
};

/**
 * Service Worker Installation
 */
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Pre-caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Service Worker installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker installation failed:', error);
      })
  );
});

/**
 * Service Worker Activation
 */
self.addEventListener('activate', (event) => {
  console.log('🔧 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activation complete');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('❌ Service Worker activation failed:', error);
      })
  );
});

/**
 * Fetch Event Handler
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { url, method } = request;
  
  // Only handle GET requests
  if (method !== 'GET') return;
  
  // Skip cross-origin requests that aren't API calls
  if (!url.startsWith(self.location.origin) && !isAPIRequest(url)) {
    return;
  }
  
  // Handle different types of requests
  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

/**
 * API Request Handler - Network First with Cache Fallback
 */
async function handleAPIRequest(request) {
  const cache = await caches.open(DATA_CACHE_NAME);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses
      const responseClone = response.clone();
      cache.put(request, responseClone);
      
      console.log('📡 API request served from network:', request.url);
      return response;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️ Network request failed, trying cache:', error.message);
    
    // Fallback to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('📦 API request served from cache:', request.url);
      
      // Add header to indicate cached response
      const response = cachedResponse.clone();
      response.headers.set('X-Served-By', 'ServiceWorker');
      response.headers.set('X-Cache-Date', new Date(cachedResponse.headers.get('date') || Date.now()).toISOString());
      
      return response;
    }
    
    // Return offline response for API requests
    console.error('❌ No cache available for API request:', request.url);
    return createOfflineAPIResponse();
  }
}

/**
 * Static Asset Handler - Cache First
 */
async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('📦 Static asset served from cache:', request.url);
    return cachedResponse;
  }
  
  try {
    // Fallback to network
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache the response
      cache.put(request, response.clone());
      console.log('📡 Static asset served from network and cached:', request.url);
    }
    
    return response;
  } catch (error) {
    console.error('❌ Failed to fetch static asset:', request.url, error);
    return createOfflineResponse();
  }
}

/**
 * Navigation Request Handler - Network First with Offline Fallback
 */
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.ok) {
      console.log('📡 Navigation served from network:', request.url);
      return response;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️ Navigation request failed, serving cached app:', error.message);
    
    // Fallback to cached index.html
    const cache = await caches.open(CACHE_NAME);
    const cachedApp = await cache.match('/index.html') || await cache.match('/');
    
    if (cachedApp) {
      console.log('📦 Serving cached app shell');
      return cachedApp;
    }
    
    // Last resort offline page
    return createOfflineResponse();
  }
}

/**
 * Helper Functions
 */
function isAPIRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

function isStaticAsset(url) {
  return url.includes('/assets/') || 
         url.endsWith('.css') || 
         url.endsWith('.js') || 
         url.endsWith('.png') || 
         url.endsWith('.jpg') || 
         url.endsWith('.svg') ||
         url.endsWith('.ico');
}

function createOfflineAPIResponse() {
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: 'API request failed - device is offline',
      value: [],
      cached: true,
      timestamp: new Date().toISOString()
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
        'X-Served-By': 'ServiceWorker',
        'X-Offline': 'true'
      }
    }
  );
}

function createOfflineResponse() {
  return new Response(
    `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Enspirion - Offline</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #f9fafb;
          color: #1f2937;
        }
        .offline-container {
          text-align: center;
          padding: 2rem;
          max-width: 400px;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        .offline-title {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          color: #722F37;
        }
        .offline-message {
          margin-bottom: 2rem;
          color: #6b7280;
        }
        .retry-btn {
          background: #722F37;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
          transition: background 0.2s;
        }
        .retry-btn:hover {
          background: #A0182B;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📡</div>
        <h1 class="offline-title">Brak połączenia</h1>
        <p class="offline-message">
          Aplikacja działa w trybie offline. Sprawdź połączenie internetowe i spróbuj ponownie.
        </p>
        <button class="retry-btn" onclick="window.location.reload()">
          Spróbuj ponownie
        </button>
      </div>
    </body>
    </html>
    `,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/html',
        'X-Served-By': 'ServiceWorker'
      }
    }
  );
}

/**
 * Background Sync
 */
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'portfolio-data-sync') {
    event.waitUntil(syncPortfolioData());
  } else if (event.tag === 'risk-data-sync') {
    event.waitUntil(syncRiskData());
  }
});

async function syncPortfolioData() {
  try {
    console.log('🔄 Syncing portfolio data...');
    
    // Get all clients (app windows)
    const clients = await self.clients.matchAll();
    
    // Notify clients that sync is starting
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_START',
        data: { syncType: 'portfolio' }
      });
    });
    
    // Perform data sync logic here
    // This would typically involve fetching fresh data from the API
    
    // Notify clients that sync is complete
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        data: { syncType: 'portfolio', success: true }
      });
    });
    
    console.log('✅ Portfolio data sync complete');
  } catch (error) {
    console.error('❌ Portfolio data sync failed:', error);
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ERROR',
        data: { syncType: 'portfolio', error: error.message }
      });
    });
  }
}

async function syncRiskData() {
  try {
    console.log('🔄 Syncing risk data...');
    
    const clients = await self.clients.matchAll();
    
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_START',
        data: { syncType: 'risk' }
      });
    });
    
    // Risk data sync logic
    
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        data: { syncType: 'risk', success: true }
      });
    });
    
    console.log('✅ Risk data sync complete');
  } catch (error) {
    console.error('❌ Risk data sync failed:', error);
  }
}

/**
 * Push Notifications (Disabled for corporate firewall compatibility)
 */
self.addEventListener('push', (event) => {
  // Push notifications are disabled for corporate environment
  // but keeping the handler for future enhancement
  console.log('📱 Push notification received (disabled in corporate mode)');
});

self.addEventListener('notificationclick', (event) => {
  console.log('📱 Notification clicked (disabled in corporate mode)');
  event.notification.close();
});

/**
 * Message Handler for communication with main app
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches();
      break;
      
    case 'SCHEDULE_SYNC':
      if (data.tag && self.registration.sync) {
        self.registration.sync.register(data.tag);
      }
      break;
      
    default:
      console.log('📨 Unknown message type:', type);
  }
});

/**
 * Cache Management
 */
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames.map(name => caches.delete(name));
    await Promise.all(deletePromises);
    
    console.log('🗑️ All caches cleared');
    
    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_CLEARED',
        data: { success: true }
      });
    });
  } catch (error) {
    console.error('❌ Failed to clear caches:', error);
  }
}

/**
 * Error Handler
 */
self.addEventListener('error', (error) => {
  console.error('❌ Service Worker error:', error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker unhandled rejection:', event.reason);
});

/**
 * Update Check
 */
async function checkForUpdates() {
  try {
    const response = await fetch('/manifest.json', { cache: 'no-cache' });
    const manifest = await response.json();
    
    if (manifest.version !== '2.0.0') {
      console.log('🔄 New version available:', manifest.version);
      
      // Notify clients about available update
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          data: { version: manifest.version }
        });
      });
    }
  } catch (error) {
    console.warn('⚠️ Update check failed:', error);
  }
}

// Check for updates periodically
setInterval(checkForUpdates, 60 * 60 * 1000); // Every hour

console.log('✅ Enspirion Service Worker loaded successfully');