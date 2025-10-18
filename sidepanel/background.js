// ==============================
// Overleaf Assistant Background Service Worker
// ==============================
import buildFileTree from "../template-generation/fileTreeBuilder.js";

// ------------------------------
// On install
// ------------------------------
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Background] Overleaf Assistant installed");
});

// Background service worker (background.js)

// Offline detection and notification
async function checkOnlineStatus() {
  try {
    const promises = [
      fetch('https://www.overleaf.com/favicon.ico', { method: 'HEAD', mode: 'no-cors', cache: 'no-cache' }),
      fetch('https://www.google.com/favicon.ico', { method: 'HEAD', mode: 'no-cors', cache: 'no-cache' })
    ];
    
    await Promise.race(promises.map(p => 
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timeout')), 3000);
        p.then(() => {
          clearTimeout(timeout);
          resolve();
        }).catch(reject);
      })
    ));
    
    return true; // online
  } catch {
    return false; // offline
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    checkOnlineStatus().then(online => {
      if (!online) {
        console.log(`[Offline] User is offline when accessing: ${details.url}`);
        chrome.tabs.query({ url: "*://www.overleaf.com/project/*" }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: "offlineDetected", url: details.url });
          });
        });
      } else {
        console.log(`[Online] Accessing: ${details.url}`);
      }
    });
    return {};
  },
  { urls: ["*://www.overleaf.com/project/*"], types: ["main_frame"] }
);

// ===============================
// Enhanced Sync & Project Management
// ===============================

class ProjectSyncManager {
  constructor() {
    this.syncQueue = new Map();
    this.syncInProgress = new Set();
  }

  async syncProject(projectId, files) {
    if (this.syncInProgress.has(projectId)) {
      console.log(`[Sync] Sync already in progress for project ${projectId}`);
      return { success: false, error: 'Sync already in progress' };
    }

    this.syncInProgress.add(projectId);

    try {
      console.log(`[Sync] Starting sync for project ${projectId}`);
      
      // Store the files data for potential future use
      await this.storeProjectFiles(projectId, files);
      
      // Simulate sync (replace with real API upload)
      await this.simulateSync();
      
      console.log(`[Sync] Successfully synced project ${projectId}`);
      return { success: true };
      
    } catch (error) {
      console.error(`[Sync] Failed to sync project ${projectId}:`, error);
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress.delete(projectId);
    }
  }

  async storeProjectFiles(projectId, files) {
    const syncData = {
      projectId,
      files,
      lastSync: Date.now(),
      syncStatus: 'pending'
    };
    
    await chrome.storage.local.set({ 
      [`sync_${projectId}`]: syncData 
    });
  }

  async simulateSync() {
    // Simulate network delay
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  async getProjectSyncStatus(projectId) {
    const data = await chrome.storage.local.get([`sync_${projectId}`]);
    return data[`sync_${projectId}`] || null;
  }

  async clearSyncData(projectId) {
    await chrome.storage.local.remove([`sync_${projectId}`]);
  }
}

const syncManager = new ProjectSyncManager();

// ===============================
// Message listener for sync commands
// ===============================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "syncProject") {
    syncManager.syncProject(msg.projectId, msg.files)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // async response
  }
  
  if (msg.action === "getSyncStatus") {
    syncManager.getProjectSyncStatus(msg.projectId)
      .then(status => sendResponse({ status }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (msg.action === "clearSync") {
    syncManager.clearSyncData(msg.projectId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});


// ------------------------------
// Command handlers (keyboard shortcuts)
// ------------------------------
chrome.commands.onCommand.addListener(async (command) => {
  console.log("[Command]", command);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url.includes("overleaf.com")) return;

  if (command === "open-files") {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleFileTree,
    });
  } else if (command === "toggle-forward" || command === "toggle-backward") {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleLayoutView,
      args: [command],
    });
  }
});

// ------------------------------
// Helper: Toggle file tree
// ------------------------------
function toggleFileTree() {
  const togglerClosed = document.querySelector(
    ".custom-toggler.custom-toggler-west.custom-toggler-closed"
  );
  if (togglerClosed) {
    togglerClosed.click();
    console.log("[Content] File tree opened");
  } else {
    const togglerOpened = document.querySelector("#ide-root > div.ide-react-main > div > div > div:nth-child(2) > div > button");
    togglerOpened?.click();
    console.log("[Content] File tree closed");
  }
}

// ------------------------------
// Helper: Toggle layout view
// ------------------------------
function toggleLayoutView(command) {
  const dropdownBtn = document.querySelector("#layout-dropdown-btn");
  if (dropdownBtn && dropdownBtn.getAttribute("aria-expanded") === "false") {
    dropdownBtn.click();
  }
  const dropdownMenu = document.querySelector(
    "#ide-root > div.ide-react-main > nav > div.toolbar-right > div.toolbar-item.layout-dropdown.dropdown > ul"
  );
  if (!dropdownMenu) return console.error("Dropdown menu not found");

  const options = dropdownMenu.querySelectorAll("a.dropdown-item");
  let currentIdx = -1;
  options.forEach((opt, i) => {
    if (opt.classList.contains("active")) currentIdx = i;
  });
  if (currentIdx === -1) return console.error("No selected layout found");

  let nextIdx = currentIdx;
  do {
    nextIdx =
      command === "toggle-forward"
        ? (nextIdx + 1) % options.length
        : (nextIdx - 1 + options.length) % options.length;
  } while (options[nextIdx].textContent.includes("PDF in separate tab"));

  options[nextIdx].click();
  console.log("[Content] Layout toggled to", options[nextIdx].textContent);
}

// ------------------------------
// Upload Panel & File Handling
// ------------------------------
const panelState = {}; // per tab tracking

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message?.action) return;
  const tabId = sender.tab?.id;

  switch (message.action) {
    case "toggle-upload-panel":
      handleTogglePanel(tabId, message.projectId, message.projectName);
      break;

    case "upload-panel-closed":
      if (tabId) panelState[tabId] = false;
      break;

    case "build-and-upload-files":
      handleBuildAndUpload(tabId, message.projectId, message.templateId);
      break;
  }
});

// ------------------------------
// Handle: Toggle upload panel
// ------------------------------
async function handleTogglePanel(tabId, projectId, projectName) {
  if (!tabId) return;
  const isOpen = panelState[tabId];

  if (isOpen) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const p = document.getElementById("overleaf-upload-panel");
        if (p) p.remove();
      },
    });
    panelState[tabId] = false;
    return;
  }

  chrome.storage.local.get(["configProjects", "template"], async (data) => {
    const configProjects = data.configProjects || {};
    const templates = data.template || {};
    let project = configProjects[projectId];

    if (!project) {
      project = {
        name: projectName,
      };
      configProjects[projectId] = project;
      chrome.storage.local.set({ configProjects }, () => {
        console.log(`[Uploader] Project ${projectName} added!`);
      });
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectUploadPanel,
      args: [projectId, project, templates],
    });
    panelState[tabId] = true;
  });
}

// ------------------------------
// Handle: Build + Upload
// ------------------------------
async function handleBuildAndUpload(tabId, projectId, templateId) {
  chrome.storage.local.get(["configProjects", "template"], async (data) => {
    const project = (data.configProjects || {})[projectId];
    const templateObj = (data.template || {})[templateId];

    if (!project || !templateObj) {
      console.error("[Upload] Missing project or template for upload.");
      return;
    }

    console.log("[Upload] Opening file tree...");
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const closed = document.querySelector(".custom-toggler.custom-toggler-west.custom-toggler-closed");
        if (closed) closed.click();
      },
    });

    console.log("[Upload] Building file tree...");
    const vars = { ...project.variables };
    const builtTree = buildFileTree(templateObj.files, vars);
    console.log("[Upload] Built file tree", builtTree);

    // inside your background.js where upload happens
    console.log("[Upload] Uploading files to Overleaf...");

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["template-generation/overleafUploader.js"]
    });

    console.log("[Upload] Uploader script injected.");

    // Give it a bit of time to register window.uploadFileTreeToOverleaf
    await new Promise(resolve => setTimeout(resolve, 300));

    await chrome.scripting.executeScript({
      target: { tabId },
      args: [projectId, builtTree],
      func: (projectId, fileTree) => {
        if (window.uploadFileTreeToOverleaf) {
          console.log("[Upload] Running uploader in Overleaf tab...");
          window.uploadFileTreeToOverleaf(projectId, fileTree);
        } else {
          console.error("[Upload] Uploader not found in window context!");
        }
      }
    });
  });
}

// ------------------------------
// Inject Upload Panel
// ------------------------------
function injectUploadPanel(projectId, project, templates) {
  const existing = document.getElementById("overleaf-upload-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "overleaf-upload-panel";
  Object.assign(panel.style, {
    position: "fixed",
    top: "60px",
    right: "10px",
    width: "280px",
    background: "#1e1e1e",
    color: "#fff",
    padding: "14px",
    borderRadius: "10px",
    boxShadow: "0 0 8px rgba(0,0,0,0.3)",
    zIndex: "99999",
  });

  const title = document.createElement("div");
  title.textContent = `Upload for: ${project.name}`;
  title.style.marginBottom = "10px";
  title.style.fontWeight = "bold";
  panel.appendChild(title);

  const dropdown = document.createElement("select");
  Object.assign(dropdown.style, {
    width: "100%",
    marginBottom: "10px",
    padding: "6px",
    borderRadius: "6px",
  });
  const def = document.createElement("option");
  def.textContent = "-- Select Template --";
  dropdown.appendChild(def);
  (project.templates || []).forEach((tid) => {
    const opt = document.createElement("option");
    opt.value = tid;
    opt.textContent = templates[tid]?.name || "Unnamed Template";
    dropdown.appendChild(opt);
  });
  panel.appendChild(dropdown);

  const btn = document.createElement("button");
  btn.textContent = "Build & Upload";
  Object.assign(btn.style, {
    width: "100%",
    padding: "8px",
    backgroundColor: "#4CAF50",
    border: "none",
    color: "white",
    borderRadius: "6px",
  });
  btn.onclick = () => {
    const tid = dropdown.value;
    if (!tid) return alert("Select a template first");
    chrome.runtime.sendMessage({
      action: "build-and-upload-files",
      projectId,
      templateId: tid,
    });
  };
  panel.appendChild(btn);

  const close = document.createElement("div");
  close.textContent = "×";
  Object.assign(close.style, {
    position: "absolute",
    top: "6px",
    right: "10px",
    cursor: "pointer",
  });
  close.onclick = () => {
    panel.remove();
    chrome.runtime.sendMessage({ action: "upload-panel-closed" });
  };
  panel.appendChild(close);

  document.body.appendChild(panel);
}
