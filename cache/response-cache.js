/**
 * HTTP Response Caching System for Overleaf
 * Caches API responses and serves them when offline
 */

class OverleafResponseCache {
  constructor() {
    this.cachePrefix = 'overleaf_cache_';
    this.projectCachePrefix = 'project_cache_';
    this.maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours
    this.apiPatterns = [
      /\/project\/([^\/]+)\/file\/([^\/]+)/,
      /\/project\/([^\/]+)\/folder/,
      /\/project\/([^\/]+)\/doc\/([^\/]+)/,
      /\/project\/([^\/]+)\/compile/,
      /\/project\/([^\/]+)\/sync/,
      /\/project\/([^\/]+)$/
    ];
  }

  /**
   * Check if URL should be cached
   */
  shouldCache(url, method = 'GET') {
    // Only cache GET requests for now
    if (method !== 'GET') return false;
    
    return this.apiPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract project ID from URL
   */
  extractProjectId(url) {
    for (const pattern of this.apiPatterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Generate cache key for request
   */
  generateCacheKey(url, method = 'GET', headers = {}) {
    const projectId = this.extractProjectId(url);
    const urlPath = new URL(url).pathname;
    return `${this.cachePrefix}${projectId}_${method}_${btoa(urlPath)}`;
  }

  /**
   * Cache API response
   */
  async cacheResponse(url, method, headers, responseData, statusCode = 200) {
    try {
      const cacheKey = this.generateCacheKey(url, method, headers);
      const projectId = this.extractProjectId(url);
      
      const cacheEntry = {
        url,
        method,
        headers,
        data: responseData,
        statusCode,
        timestamp: Date.now(),
        projectId
      };
      
      await chrome.storage.local.set({ [cacheKey]: cacheEntry });
      
      // Also update project-level cache
      if (projectId) {
        await this.updateProjectCache(projectId, url, responseData);
      }
      
      console.log(`[Cache] Cached response for ${url}`);
      return true;
    } catch (error) {
      console.error('[Cache] Failed to cache response:', error);
      return false;
    }
  }

  /**
   * Retrieve cached response
   */
  async getCachedResponse(url, method = 'GET', headers = {}) {
    try {
      const cacheKey = this.generateCacheKey(url, method, headers);
      const result = await chrome.storage.local.get([cacheKey]);
      const cacheEntry = result[cacheKey];
      
      if (!cacheEntry) {
        console.log(`[Cache] No cache entry found for ${url}`);
        return null;
      }
      
      // Check if cache is still valid
      const age = Date.now() - cacheEntry.timestamp;
      if (age > this.maxCacheAge) {
        console.log(`[Cache] Cache expired for ${url}`);
        await chrome.storage.local.remove([cacheKey]);
        return null;
      }
      
      console.log(`[Cache] Serving cached response for ${url}`);
      return cacheEntry;
    } catch (error) {
      console.error('[Cache] Failed to retrieve cached response:', error);
      return null;
    }
  }

  /**
   * Update project-level cache with file/folder structure
   */
  async updateProjectCache(projectId, url, responseData) {
    try {
      const projectCacheKey = `${this.projectCachePrefix}${projectId}`;
      const existing = await chrome.storage.local.get([projectCacheKey]);
      const projectCache = existing[projectCacheKey] || {
        projectId,
        files: {},
        folders: {},
        lastUpdate: Date.now()
      };
      
      // Parse different types of responses
      if (url.includes('/file/')) {
        // File content
        const fileMatch = url.match(/\/file\/([^\/]+)/);
        if (fileMatch) {
          const fileId = fileMatch[1];
          projectCache.files[fileId] = {
            id: fileId,
            content: responseData,
            lastModified: Date.now()
          };
        }
      } else if (url.includes('/folder') || url.endsWith(`/project/${projectId}`)) {
        // Project structure
        if (responseData && responseData.rootFolder) {
          projectCache.structure = responseData;
          projectCache.folders = this.extractFolderStructure(responseData.rootFolder);
        }
      }
      
      projectCache.lastUpdate = Date.now();
      await chrome.storage.local.set({ [projectCacheKey]: projectCache });
      
    } catch (error) {
      console.error('[Cache] Failed to update project cache:', error);
    }
  }

  /**
   * Extract folder structure from Overleaf response
   */
  extractFolderStructure(rootFolder, path = '') {
    const structure = {};
    
    if (rootFolder.folders) {
      rootFolder.folders.forEach(folder => {
        const folderPath = path ? `${path}/${folder.name}` : folder.name;
        structure[folder._id] = {
          id: folder._id,
          name: folder.name,
          path: folderPath,
          type: 'folder'
        };
        
        // Recursively process subfolders
        Object.assign(structure, this.extractFolderStructure(folder, folderPath));
      });
    }
    
    if (rootFolder.docs) {
      rootFolder.docs.forEach(doc => {
        const docPath = path ? `${path}/${doc.name}` : doc.name;
        structure[doc._id] = {
          id: doc._id,
          name: doc.name,
          path: docPath,
          type: 'doc'
        };
      });
    }
    
    if (rootFolder.fileRefs) {
      rootFolder.fileRefs.forEach(file => {
        const filePath = path ? `${path}/${file.name}` : file.name;
        structure[file._id] = {
          id: file._id,
          name: file.name,
          path: filePath,
          type: 'file'
        };
      });
    }
    
    return structure;
  }

  /**
   * Get complete project cache
   */
  async getProjectCache(projectId) {
    try {
      const projectCacheKey = `${this.projectCachePrefix}${projectId}`;
      const result = await chrome.storage.local.get([projectCacheKey]);
      return result[projectCacheKey] || null;
    } catch (error) {
      console.error('[Cache] Failed to get project cache:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific project
   */
  async clearProjectCache(projectId) {
    try {
      // Remove project cache
      const projectCacheKey = `${this.projectCachePrefix}${projectId}`;
      await chrome.storage.local.remove([projectCacheKey]);
      
      // Remove all related API caches
      const storage = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(storage).filter(key => 
        key.startsWith(this.cachePrefix) && key.includes(projectId)
      );
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
      
      console.log(`[Cache] Cleared cache for project ${projectId}`);
    } catch (error) {
      console.error('[Cache] Failed to clear project cache:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache() {
    try {
      const storage = await chrome.storage.local.get(null);
      const now = Date.now();
      const keysToRemove = [];
      
      Object.keys(storage).forEach(key => {
        if (key.startsWith(this.cachePrefix)) {
          const entry = storage[key];
          if (entry.timestamp && (now - entry.timestamp) > this.maxCacheAge) {
            keysToRemove.push(key);
          }
        }
      });
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`[Cache] Cleaned up ${keysToRemove.length} expired cache entries`);
      }
    } catch (error) {
      console.error('[Cache] Failed to cleanup expired cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const storage = await chrome.storage.local.get(null);
      const stats = {
        totalEntries: 0,
        totalSize: 0,
        projectCaches: 0,
        apiCaches: 0,
        oldestEntry: Date.now(),
        newestEntry: 0
      };
      
      Object.keys(storage).forEach(key => {
        if (key.startsWith(this.cachePrefix) || key.startsWith(this.projectCachePrefix)) {
          stats.totalEntries++;
          const entry = storage[key];
          const size = JSON.stringify(entry).length;
          stats.totalSize += size;
          
          if (key.startsWith(this.projectCachePrefix)) {
            stats.projectCaches++;
          } else {
            stats.apiCaches++;
          }
          
          if (entry.timestamp) {
            stats.oldestEntry = Math.min(stats.oldestEntry, entry.timestamp);
            stats.newestEntry = Math.max(stats.newestEntry, entry.timestamp);
          }
        }
      });
      
      return stats;
    } catch (error) {
      console.error('[Cache] Failed to get cache stats:', error);
      return null;
    }
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.OverleafResponseCache = OverleafResponseCache;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OverleafResponseCache;
}
