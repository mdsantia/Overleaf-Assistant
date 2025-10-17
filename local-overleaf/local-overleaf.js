(async function () {
    const params = new URLSearchParams(location.search);
    const projectId = params.get("project");
    const editorContainer = document.getElementById("editor-container");
  
    const data = await chrome.storage.local.get([`project_${projectId}`]);
    const projectData = data[`project_${projectId}`] || { files: {} };
    const files = projectData.files;
  
    // Build editor UI
    Object.entries(files).forEach(([filename, content]) => {
      const wrapper = document.createElement("div");
      wrapper.className = "file-editor";
  
      const label = document.createElement("div");
      label.className = "filename";
      label.textContent = filename;
  
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.addEventListener("input", (e) => {
        files[filename] = e.target.value;
        chrome.storage.local.set({ [`project_${projectId}`]: { files } });
      });
  
      wrapper.appendChild(label);
      wrapper.appendChild(textarea);
      editorContainer.appendChild(wrapper);
    });
  
    // Sync banner logic
    const banner = document.getElementById("offline-banner");
    function updateBanner() {
      banner.textContent = navigator.onLine
        ? "🟢 Online — Ready to sync changes"
        : "🔴 Offline Mode — Changes saved locally";
    }
    updateBanner();
    window.addEventListener("online", updateBanner);
    window.addEventListener("offline", updateBanner);
  
    // When back online
    window.addEventListener("online", async () => {
      const confirmSync = confirm("You're back online! Sync changes to Overleaf?");
      if (confirmSync) {
        chrome.runtime.sendMessage({
          action: "syncProject",
          projectId,
          files,
        });
      } else {
        if (confirm("Discard local edits and return to Overleaf.com?")) {
          window.location.href = `https://www.overleaf.com/project/${projectId}`;
        }
      }
    });
  })();
  