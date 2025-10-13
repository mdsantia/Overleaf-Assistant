// ==============================
// Overleaf File Uploader
// ==============================

window.uploadFileTreeToOverleaf = async function uploadFileTreeToOverleaf(projectId, fileTree) {
  if (!document) {
    console.error("[Uploader] No DOM context — must be run inside Overleaf tab");
    return;
  }

  // ✅ Close upload panel if open
  const panel = document.getElementById("overleaf-upload-panel");
  if (panel) {
    panel.remove();
    console.log("[Uploader] Upload panel closed before starting upload.");
  }

  const totalItems = countItems(fileTree);
  let processed = 0;

  showLoadingOverlay("Preparing upload...");

  async function updateProgress(label) {
    const percent = Math.round((processed / totalItems) * 100);
    const overlayText = document.querySelector("#upload-overlay div:last-child");
    if (overlayText) overlayText.innerText = `Uploading ${processed}/${totalItems} (${percent}%) — ${label}`;
  }

  console.log(`[Uploader] Starting upload for project ${projectId}`);

  const fileTreeContainer = document.querySelector("#panel-file-tree .file-tree-inner > ul > div");
  if (!fileTreeContainer) {
    console.warn("[Uploader] File tree not ready yet");
    hideLoadingOverlay();
    return;
  }

  await walkTree("", fileTree, null);

  hideLoadingOverlay();
  // alert("✅ Upload completed!");

  // Recursive walk
  async function walkTree(prefix, items, parentFolder) {
    if (parentFolder) {
      parentFolder.querySelector('div > div > button[aria-label="Expand"]')?.click();
      await delay(250);
    } else {
      await clickRootFileTree();
    }

    for (const item of items) {
      const currentPath = prefix ? `${prefix}/${item.name}` : item.name;
      processed++;
      await updateProgress(`Creating ${currentPath}`);

      if (item.type === "folder") {
        let folder = findItemByNameInParent(item.name, parentFolder);
        if (!folder) folder = await addFolder(item.name, parentFolder);
        if (!folder) continue;
        if (item.children?.length) await walkTree(currentPath, item.children, folder);
        folder.querySelector('div > div > button[aria-label="Collapse"]')?.click();
      } else if (item.type === "file") {
        const fileIl = findItemByNameInParent(item.name, parentFolder);
        if (!fileIl) await createFile(item.name, item.content, parentFolder) 
        else await editFile(item.name, fileIl, item.content);
      }
    }
  }
};

// ==============================
// Folder Creation
// ==============================
async function addFolder(folderName, parentFolder = null) {
  console.log(`[Uploader] Adding folder: ${folderName}`);
  if (parentFolder) parentFolder.click();
  else await clickRootFileTree();

  const btn = document.querySelector("#panel-file-tree .toolbar-filetree button:nth-child(2)");
  if (!btn) return console.error("[Uploader] 'New Folder' button not found");
  btn.click();
  await delay(250);

  const input = await waitForElement("#folder-name", 3000);
  input.value = folderName;
  input.dispatchEvent(new Event("input", { bubbles: true }));

  const okBtn = document.querySelector(".modal.show .btn.btn-primary");
  okBtn?.click();

  const folderElem = await waitForItemByName(folderName, parentFolder);
  if (!folderElem) console.error(`[Uploader] ❌ Folder '${folderName}' not created.`);
  else console.log(`[Uploader] ✅ Folder '${folderName}' created.`);
  return folderElem;
}

// ==============================
// File Creation
// ==============================
async function createFile(fileName, content, parentFolder = null) {
  console.log(`[Uploader] Creating file: ${fileName}`);
  if (parentFolder) parentFolder.click();
  else await clickRootFileTree();

  const btn = document.querySelector("#panel-file-tree .toolbar-filetree button:nth-child(1)");
  if (!btn) return console.error("[Uploader] 'New File' button not found");
  btn.click();
  await delay(250);

  const input = await waitForElement("#new-doc-name", 3000);
  input.value = fileName;
  input.dispatchEvent(new Event("input", { bubbles: true }));

  const okBtn = document.querySelector(".modal.show .btn.btn-primary");
  okBtn?.click();

  const fileElem = await waitForItemByName(fileName, parentFolder);
  if (!fileElem) {
    console.error(`[Uploader] ❌ File '${fileName}' not found after creation.`);
    return;
  }

  await editFile(fileName, fileElem, content)
}

// ==============================
// File Replacement
// ==============================
async function editFile(fileName, fileElem, content) {
  fileElem.click();
  await delay(700);
  await setEditorContent(content);
  triggerAutosave();
  console.log(`[Uploader] ✅ File written: ${fileName}`);
}

// ==============================
// Editor Interaction
// ==============================
async function setEditorContent(content) {
  console.log("[Uploader] Setting editor content...");

  const editorRoot = await waitForElement('.cm-content[contenteditable="true"]', 10000);
  if (!editorRoot) {
    console.error("[Uploader] Editor not found — aborting write.");
    return false;
  }

  editorRoot.focus();

  // Clear existing text by selecting all and replacing innerText directly
  const range = document.createRange();
  range.selectNodeContents(editorRoot);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  // Modern replacement for execCommand("delete")
  if (!sel.isCollapsed && typeof sel.deleteFromDocument === "function") {
    sel.deleteFromDocument();
  } else {
    // fallback: manually clear innerText
    editorRoot.innerText = "";
  }

  // Inject new content
  editorRoot.innerText = content;

  console.log("[Uploader] ✅ Content injected successfully.");
  return true;
}

// Simulate a keystroke to trigger Overleaf autosave
function triggerAutosave() {
  const editorRoot = document.querySelector('.cm-content[contenteditable="true"]');
  if (!editorRoot) return;
  const event = new KeyboardEvent("keydown", { key: " ", bubbles: true });
  editorRoot.dispatchEvent(event);
  console.log("[Uploader] ⌨️ Triggered autosave event.");
}

// ==============================
// DOM Search Helpers
// ==============================
async function waitForItemByName(name, parentFolder = null, timeout = 8000, interval = 300) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = findItemByNameInParent(name, parentFolder);
    if (el) return el;
    await delay(interval);
  }
  return null;
}

function findItemByNameInParent(name, parentFolder = null) {
  if (!parentFolder) {
    // root-level search
    const rootLis = document.querySelectorAll("#panel-file-tree > div > div.file-tree-inner > ul > div > li[role='treeitem']");
    return Array.from(rootLis).find(li => li.getAttribute("aria-label") === name) || null;
  }
  
  const innerList = parentFolder.nextElementSibling;

  if (innerList && innerList.tagName === "UL") {
    if (!innerList) return null;
    return Array.from(innerList.querySelectorAll("div > li[role='treeitem']")).find(li =>
      li.getAttribute("aria-label") === name) || null;
  }
}

async function clickRootFileTree() {
  const tree = document.querySelector("#panel-file-tree .file-tree-inner > ul");
  if (!tree) return console.warn("[Uploader] Root file tree not found");
  tree.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));
  await delay(200);
}

// ==============================
// Misc Helpers
// ==============================
function countItems(tree) {
  let count = 0;
  for (const item of tree) {
    count++;
    if (item.children) count += countItems(item.children);
  }
  return count;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms));
}

async function waitForElement(selector, timeout = 5000, interval = 200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await delay(interval);
  }
  return null;
}


// ==============================
// Loading Overlay
// ==============================
function showLoadingOverlay(message = "Uploading...") {
  if (document.querySelector("#upload-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "upload-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(6px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "9999",
    fontSize: "18px",
    color: "#333",
  });

  const spinner = document.createElement("div");
  Object.assign(spinner.style, {
    border: "6px solid #f3f3f3",
    borderTop: "6px solid #555",
    borderRadius: "50%",
    width: "50px",
    height: "50px",
    animation: "spin 1s linear infinite",
  });

  const text = document.createElement("div");
  text.innerText = message;
  text.style.marginTop = "20px";

  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes spin { 
      0% { transform: rotate(0deg); } 
      100% { transform: rotate(360deg); } 
    }`;

  overlay.appendChild(spinner);
  overlay.appendChild(text);
  document.body.appendChild(style);
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  const overlay = document.querySelector("#upload-overlay");
  if (overlay) overlay.remove();
}