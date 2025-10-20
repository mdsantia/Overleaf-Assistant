// ==============================
// Overleaf Assistant Background Service Worker
// ==============================
import buildFileTree from "../template-generation/fileTreeBuilder.js";

const defaultShortcuts = {
  "toggle-file-tree": {
    key: "h", ctrl: true, shift: false, alt: false, meta: false
  },
  "only-editor": {
    key: "ArrowRight", ctrl: true, shift: true, alt: false, meta: false
  },
  "only-pdf": {
    key: "ArrowLeft", ctrl: true, shift: true, alt: false, meta: false
  },
  "editor-pdf": {
    key: "ArrowUp", ctrl: true, shift: true, alt: false, meta: false
  },
  "pdf-tab": {
    key: "ArrowDown", ctrl: true, shift: true, alt: false, meta: false
  }
};

// Detect Mac and update modifiers
function applyPlatformShortcuts(shortcuts) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  if (!isMac) return shortcuts;

  const updated = {};
  for (const [command, value] of Object.entries(shortcuts)) {
    updated[command] = {
      ...value,
      meta: value.ctrl,
      ctrl: false
    };
  }
  return updated;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("command_customizations", (data) => {
    if (!data.command_customizations) {
      const updatedShortcuts = applyPlatformShortcuts(defaultShortcuts);
      chrome.storage.local.set({ command_customizations: updatedShortcuts }, () => {
        console.log("[Overleaf Helper] Default shortcuts saved.");
      });
    }
  });
});


// ============================
// KEYBOARD HANDLING
// ============================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "get-shortcuts") {
    chrome.storage.local.get("command_customizations", (result) => {
      sendResponse(result.command_customizations);
    });

    // Required: true when using sendResponse asynchronously
    return true;
  }

  if (msg.type === "key-pressed") {
    console.log(`[SHORTCUT] Command triggered: ${msg.command}`);
    handleShortcut(msg.command, sender.tab);
  }
});

function handleShortcut(command, tab) {
  switch (command) {
  case "toggle-file-tree":
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleFileTree
    });
    break;
  case "only-editor":
  case "only-pdf":
  case "editor-pdf":
  case "pdf-tab":
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleLayoutView,
      args: [command, tab]
    });
    break;
  }
}

//
// ON PDF SEPARATE TAB
//
// chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//   const currentTab = tabs[0];
//   const url = new URL(currentTab.url);

//   // Check if it's an Overleaf project tab
//   const match = url.href.match(/https:\/\/www\.overleaf\.com\/project\/([\w-]+)/);
//   if (!match) return;

//   const projectId = match[1];
//   const detachedUrl = `https://www.overleaf.com/project/${projectId}/detached`;

//   chrome.runtime.getPlatformInfo((info) => {
//     const isMac = info.os === "mac";
  
//     chrome.windows.getCurrent((originalWindow) => {
//       setTimeout(() => {
//         // Try to refocus original
//         chrome.windows.update(originalWindow.id, { focused: true }, () => {
//           chrome.tabs.update(originalWindow.tabs[0].id, { active: true });
//         });
//       }, isMac ? 800 : 300);
//     });
//   });  
// });


// ============================
// CONTENT SCRIPT HELPERS
// ============================
function toggleFileTree() {
  const togglerClosed = document.querySelector(
    ".custom-toggler.custom-toggler-west.custom-toggler-closed"
  );
  if (togglerClosed) {
    togglerClosed.click();
  } else {
    const togglerOpened = document.querySelector(
      "#ide-root > div.ide-react-main > div > div > div:nth-child(2) > div > button"
    );
    togglerOpened?.click();
  }
}

function toggleLayoutView(command, tab) {
  const layoutMap = {
    "editor-pdf": 0,
    "only-editor": 1,
    "only-pdf": 2,
    "pdf-tab": 3
  };

  const dropdownBtn = document.querySelector("#layout-dropdown-btn");

  // Click the dropdown button if not expanded
  if (dropdownBtn && dropdownBtn.getAttribute("aria-expanded") === "false") {
    dropdownBtn.click();
  }

  const dropdownMenu = document.querySelector(
    "#ide-root > div.ide-react-main > nav > div.toolbar-right > div.toolbar-item.layout-dropdown.dropdown > ul"
  );
  if (!dropdownMenu) return;

  const options = dropdownMenu.querySelectorAll("a.dropdown-item");
  const desiredIndex = layoutMap[command];

  if (typeof desiredIndex !== "number" || !options[desiredIndex]) return;

  // Get current active layout index
  let currentIndex = -1;
  options.forEach((option, i) => {
    if (option.classList.contains("active")) {
      currentIndex = i;
    }
  });

  if (currentIndex !== desiredIndex) {
    // Delay the layout click by 200ms
    options[desiredIndex].click();
    const div = document.getElementById("DISPLACED");
    const toolbar = document.querySelector(
      "#ol-cm-toolbar-wrapper > div > div.ol-cm-toolbar-button-group.ol-cm-toolbar-end"
    );
    if (div && toolbar) toolbar.appendChild(div);
  } else {
    // If already selected, refocus the editor and close the dropdown after delay
    setTimeout(async () => {
      let focus;
      function toFocus(focus) {focus.focus();}
      switch (desiredIndex) {
        case 2: // pdf only
          focus = document.querySelector("#panel-pdf > div > div.pdf-viewer > div > div"); // pdf
          break;
        case 0:
        case 1:
          focus = document.querySelector('.cm-content[contenteditable="true"]'); // editor
          break;
        case 3: // tab
          return;
      }
      await dropdownBtn.click(); // Close dropdown
      toFocus(focus);
    }, 100);
  }
}

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
