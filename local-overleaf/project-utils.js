/**
 * Project Backup & Restore Utilities
 * Enhanced functionality for offline Overleaf experience
 */

class ProjectUtils {
  constructor() {
    this.compressionEnabled = true;
  }

  /**
   * Export project as ZIP file for backup
   */
  async exportProject(projectId) {
    try {
      const data = await chrome.storage.local.get([`project_${projectId}`]);
      const projectData = data[`project_${projectId}`];
      
      if (!projectData) {
        throw new Error('Project not found');
      }

      // Create ZIP-like structure (we'll use JSON for simplicity)
      const exportData = {
        metadata: {
          projectId,
          name: projectData.name || 'Untitled Project',
          exportDate: new Date().toISOString(),
          version: '1.0'
        },
        files: projectData.files || {},
        settings: {
          lastModified: projectData.lastModified,
          // Add other project settings here
        }
      };

      // Convert to blob and download
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectData.name || 'project'}_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('[Export] Project exported successfully');
      return { success: true };
    } catch (error) {
      console.error('[Export] Failed to export project:', error);
      throw error;
    }
  }

  /**
   * Import project from backup file
   */
  async importProject(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const importData = JSON.parse(e.target.result);
          
          // Validate import data structure
          if (!this.validateImportData(importData)) {
            throw new Error('Invalid backup file format');
          }
          
          const projectId = importData.metadata.projectId;
          
          // Check if project already exists
          const existingData = await chrome.storage.local.get([`project_${projectId}`]);
          if (existingData[`project_${projectId}`]) {
            const overwrite = confirm(
              `Project "${importData.metadata.name}" already exists. Overwrite?`
            );
            if (!overwrite) {
              resolve({ success: false, cancelled: true });
              return;
            }
          }
          
          // Import the project
          const projectData = {
            name: importData.metadata.name,
            files: importData.files,
            lastModified: importData.settings.lastModified || Date.now(),
            importDate: Date.now()
          };
          
          await chrome.storage.local.set({ 
            [`project_${projectId}`]: projectData 
          });
          
          console.log('[Import] Project imported successfully');
          resolve({ 
            success: true, 
            projectId, 
            projectName: importData.metadata.name 
          });
        } catch (error) {
          console.error('[Import] Failed to import project:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read backup file'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Validate import data structure
   */
  validateImportData(data) {
    return data &&
           data.metadata &&
           data.metadata.projectId &&
           data.files &&
           typeof data.files === 'object';
  }

  /**
   * Get all stored projects
   */
  async getAllProjects() {
    const storage = await chrome.storage.local.get(null);
    const projects = {};
    
    Object.keys(storage).forEach(key => {
      if (key.startsWith('project_')) {
        const projectId = key.replace('project_', '');
        projects[projectId] = storage[key];
      }
    });
    
    return projects;
  }

  /**
   * Clone/duplicate a project
   */
  async cloneProject(sourceProjectId, newName) {
    try {
      const data = await chrome.storage.local.get([`project_${sourceProjectId}`]);
      const sourceProject = data[`project_${sourceProjectId}`];
      
      if (!sourceProject) {
        throw new Error('Source project not found');
      }
      
      // Generate new project ID
      const newProjectId = this.generateProjectId();
      
      // Create cloned project data
      const clonedProject = {
        ...sourceProject,
        name: newName || `${sourceProject.name} (Copy)`,
        clonedFrom: sourceProjectId,
        clonedDate: Date.now(),
        lastModified: Date.now()
      };
      
      await chrome.storage.local.set({
        [`project_${newProjectId}`]: clonedProject
      });
      
      console.log('[Clone] Project cloned successfully');
      return { success: true, projectId: newProjectId };
    } catch (error) {
      console.error('[Clone] Failed to clone project:', error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId) {
    try {
      await chrome.storage.local.remove([
        `project_${projectId}`,
        `sync_${projectId}`
      ]);
      
      console.log('[Delete] Project deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('[Delete] Failed to delete project:', error);
      throw error;
    }
  }

  /**
   * Generate a unique project ID
   */
  generateProjectId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Auto-backup functionality
   */
  async setupAutoBackup(interval = 300000) { // 5 minutes default
    console.log('[AutoBackup] Setting up auto-backup...');
    
    setInterval(async () => {
      try {
        const projects = await this.getAllProjects();
        const now = Date.now();
        
        Object.keys(projects).forEach(async (projectId) => {
          const project = projects[projectId];
          const lastBackup = project.lastAutoBackup || 0;
          
          // Backup if project was modified recently and hasn't been backed up recently
          if (project.lastModified > lastBackup && 
              (now - lastBackup) > interval) {
            
            await this.createAutoBackup(projectId, project);
            
            // Update last backup time
            project.lastAutoBackup = now;
            await chrome.storage.local.set({
              [`project_${projectId}`]: project
            });
          }
        });
      } catch (error) {
        console.error('[AutoBackup] Auto-backup failed:', error);
      }
    }, interval);
  }

  /**
   * Create automatic backup in storage
   */
  async createAutoBackup(projectId, projectData) {
    const backupKey = `backup_${projectId}_${Date.now()}`;
    const backupData = {
      ...projectData,
      backupDate: Date.now(),
      isAutoBackup: true
    };
    
    await chrome.storage.local.set({
      [backupKey]: backupData
    });
    
    // Keep only last 5 auto-backups per project
    await this.cleanupOldBackups(projectId);
  }

  /**
   * Clean up old automatic backups
   */
  async cleanupOldBackups(projectId, keepCount = 5) {
    const storage = await chrome.storage.local.get(null);
    const backups = [];
    
    Object.keys(storage).forEach(key => {
      if (key.startsWith(`backup_${projectId}_`)) {
        backups.push({
          key,
          date: storage[key].backupDate
        });
      }
    });
    
    // Sort by date (newest first) and remove old ones
    backups.sort((a, b) => b.date - a.date);
    const toRemove = backups.slice(keepCount).map(b => b.key);
    
    if (toRemove.length > 0) {
      await chrome.storage.local.remove(toRemove);
      console.log(`[Cleanup] Removed ${toRemove.length} old backups`);
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStats(projectId) {
    try {
      const data = await chrome.storage.local.get([`project_${projectId}`]);
      const project = data[`project_${projectId}`];
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      const files = project.files || {};
      const fileCount = Object.keys(files).length;
      const totalCharacters = Object.values(files).join('').length;
      const totalLines = Object.values(files).reduce((sum, content) => {
        return sum + (content.split('\n').length || 0);
      }, 0);
      
      // File type breakdown
      const fileTypes = {};
      Object.keys(files).forEach(filename => {
        const ext = filename.split('.').pop().toLowerCase();
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      });
      
      return {
        fileCount,
        totalCharacters,
        totalLines,
        fileTypes,
        lastModified: project.lastModified,
        created: project.created || project.lastModified
      };
    } catch (error) {
      console.error('[Stats] Failed to get project stats:', error);
      throw error;
    }
  }

  /**
   * Search across all project files
   */
  async searchProjects(query, projectId = null) {
    const projects = projectId ? 
      { [projectId]: (await chrome.storage.local.get([`project_${projectId}`]))[`project_${projectId}`] } :
      await this.getAllProjects();
    
    const results = [];
    
    Object.keys(projects).forEach(pid => {
      const project = projects[pid];
      if (!project || !project.files) return;
      
      Object.keys(project.files).forEach(filename => {
        const content = project.files[filename];
        const lines = content.split('\n');
        
        lines.forEach((line, lineNum) => {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              projectId: pid,
              projectName: project.name,
              filename,
              lineNumber: lineNum + 1,
              line: line.trim(),
              context: this.getLineContext(lines, lineNum)
            });
          }
        });
      });
    });
    
    return results;
  }

  /**
   * Get context around a line for search results
   */
  getLineContext(lines, lineNum, contextLines = 2) {
    const start = Math.max(0, lineNum - contextLines);
    const end = Math.min(lines.length, lineNum + contextLines + 1);
    return lines.slice(start, end);
  }
}

// Export utility functions for use in other scripts
window.ProjectUtils = ProjectUtils;