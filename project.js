export function initProjectView(projectId) {
    const titleEl = document.getElementById("projectTitle");
    const autoSaveEl = document.getElementById("projectAutoSave");
    const noteEl = document.getElementById("projectCustomNote");
    const saveBtn = document.getElementById("saveProjectBtn");
  
    chrome.storage.local.get("configProjects", (data) => {
      const projects = data.configProjects || {};
      const project = projects[projectId];
  
      if (!project) {
        titleEl.textContent = "Project not found";
        return;
      }
  
      titleEl.textContent = `Project: ${project.name}`;
      autoSaveEl.checked = project.autoSave || false;
      noteEl.value = project.customNote || "";
    });
  
    saveBtn.addEventListener("click", () => {
      chrome.storage.local.get("configProjects", (data) => {
        const projects = data.configProjects || {};
        if (!projects[projectId]) return;
  
        projects[projectId].autoSave = autoSaveEl.checked;
        projects[projectId].customNote = noteEl.value;
  
        chrome.storage.local.set({ configProjects: projects }, () => {
          alert("Project settings saved!");
        });
      });
    });
  }
  