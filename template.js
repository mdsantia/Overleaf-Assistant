// template.js
//
// Editor view for a template with nested folders/files + text editor.
// Supports: inline template name editing, drag/drop, toggle folders, active highlight.
//
let currentTemplateId = null;
let currentTemplate = null;
let currentFile = null;

import { renderTemplates } from "./config.js";

/////////////////////
// Storage helpers //
/////////////////////
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

/////////////////////////////
// Initialization function //
/////////////////////////////
export async function initTemplateView(templateId) {
  currentTemplateId = templateId;
  const data = await storageGet("template");
  const templates = data.template || {};
  currentTemplate = templates[templateId];
  if (!currentTemplate) return console.error("Template not found:", templateId);

  // DOM refs (grab fresh)
  const titleEl = document.getElementById("templateTitle");
  const deleteBtn = document.getElementById("deleteTemplateBtn");
  const fileTreeEl = document.getElementById("fileTree");
  const editorText = document.getElementById("editorText");
  const lineNumbers = document.getElementById("lineNumbers");
  const addFileBtn = document.getElementById("addFileBtn");
  const addFolderBtn = document.getElementById("addFolderBtn");

  // Inline-edit template name
  titleEl.textContent = currentTemplate.name || "Untitled Template";
  titleEl.contentEditable = true;
  titleEl.spellcheck = false;
  titleEl.addEventListener("input", () => {
    currentTemplate.name = titleEl.textContent.trim();
    saveTemplate();
  });

  deleteBtn.onclick = async () => {
    if (confirm("Delete this template?")) await deleteTemplate();
  };

  addFileBtn.onclick = () => {
    currentTemplate.files.push({ type: "file", name: "newfile.txt", content: "" });
    saveTemplate();
    renderFileTree(fileTreeEl, currentTemplate.files);
  };
  addFolderBtn.onclick = () => {
    currentTemplate.files.push({ type: "folder", name: "New Folder", children: [] });
    saveTemplate();
    renderFileTree(fileTreeEl, currentTemplate.files);
  };

  // Editor auto-save
  editorText.addEventListener("input", () => {
    if (currentFile) {
      currentFile.content = editorText.value;
      updateLineNumbers(editorText, lineNumbers);
      saveTemplate();
    }
  });

  renderFileTree(fileTreeEl, currentTemplate.files || []);
  updateLineNumbers(editorText, lineNumbers);
}

///////////////////////
// Save / Delete API //
///////////////////////
async function saveTemplate() {
  if (!currentTemplateId) return;
  const data = await storageGet("template");
  const templates = data.template || {};
  templates[currentTemplateId] = currentTemplate;
  await storageSet({ template: templates });
  await renderTemplates(); // refresh sidebar
}

async function deleteTemplate() {
  const data = await storageGet("template");
  const templates = data.template || {};
  delete templates[currentTemplateId];
  await storageSet({ template: templates });
  await renderTemplates();
  document.querySelector(".main")?.replaceChildren();
}

/////////////////////////////
// File tree manipulation  //
/////////////////////////////
function renderFileTree(container, nodes) {
  container.innerHTML = "";

  // Allow dropping into root
  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    container.classList.add("hover-target");
  });

  container.addEventListener("dragleave", () => {
    container.classList.remove("hover-target");
  });

  container.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.classList.remove("hover-target");

    let payload = JSON.parse(e.dataTransfer.getData("text/plain"));
    const srcPath = payload.path;
    if (!Array.isArray(srcPath)) return;

    const srcParentArr = getParentArrayByPath(srcPath);
    const srcIndex = srcPath[srcPath.length - 1];
    if (!srcParentArr || srcParentArr[srcIndex] == null) return;

    const movedNode = srcParentArr.splice(srcIndex, 1)[0];

    // prevent drop into self if somehow dragging a root folder onto root again
    if (movedNode === currentTemplate.files) return;

    currentTemplate.files.push(movedNode);

    saveTemplate();
    renderFileTree(document.getElementById("fileTree"), currentTemplate.files);
  });

  // Render children normally
  nodes.forEach((node, index) => {
    const el = createFileNodeElement(node, nodes, index);
    container.appendChild(el);
  });
}


function createFileNodeElement(node, parentArray, index) {
  if (node.type === "folder") {
    // Folder wrapper
    const folderItem = document.createElement("div");
    folderItem.className = "folder-item";

    // Folder header (draggable part)
    const header = document.createElement("div");
    header.className = "folder-header";

    // Arrow toggle
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = node.open ? "▼" : "▶";
    arrow.onclick = (e) => {
      e.stopPropagation();
      node.open = !node.open;
      saveTemplate();
      renderFileTree(document.getElementById("fileTree"), currentTemplate.files || []);
    };
    header.appendChild(arrow);

    // Folder name
    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name";
    nameSpan.textContent = node.name;
    nameSpan.contentEditable = true;
    nameSpan.spellcheck = false;
    nameSpan.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameSpan.blur(); // ✅ remove focus instead of adding newline
      }
    });
    nameSpan.addEventListener("input", () => {
      node.name = nameSpan.textContent.trim();
      saveTemplate();
    });
    header.appendChild(nameSpan);

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${node.name}"? This cannot be undone.`)) {
        parentArray.splice(index, 1);
        saveTemplate();
        renderFileTree(document.getElementById("fileTree"), currentTemplate.files || []);
      }
    };
    header.appendChild(deleteBtn);

    // Setup drag only on header
    setupDragAndDrop(header, node);

    // Children container
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "folder-children";
    if (node.open) renderFileTree(childrenContainer, node.children || []);

    folderItem.appendChild(header);
    folderItem.appendChild(childrenContainer);
    return folderItem;

  } else {
    // File node
    const fileNode = document.createElement("div");
    fileNode.className = "file-node";

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name";
    nameSpan.textContent = node.name;
    nameSpan.contentEditable = true;
    nameSpan.addEventListener("input", () => {
      node.name = nameSpan.textContent.trim();
      saveTemplate();
    });
    fileNode.addEventListener("click", () => openFile(node, fileNode));
    fileNode.appendChild(nameSpan);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${node.name}"?`)) {
        parentArray.splice(index, 1);
        saveTemplate();
        renderFileTree(document.getElementById("fileTree"), currentTemplate.files || []);
      }
    };
    fileNode.appendChild(deleteBtn);

    setupDragAndDrop(fileNode, node);

    return fileNode;
  }
}


/////////////////////////////
// Drag and Drop behavior  //
/////////////////////////////
function setupDragAndDrop(el, node) {
  el.draggable = true;

  el.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    const path = findNodePath(node);
    if (!path) return;
    e.dataTransfer.setData("text/plain", JSON.stringify({ path }));
    e.dataTransfer.effectAllowed = "move";
    el.classList.add("dragging");
  });

  el.addEventListener("dragend", () => {
    el.classList.remove("dragging");
    document.querySelectorAll(".hover-target").forEach((h) =>
      h.classList.remove("hover-target")
    );
  });

  // Folders are drop targets
  if (node.type === "folder") {
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.classList.add("hover-target");
    });
    el.addEventListener("dragleave", () => el.classList.remove("hover-target"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove("hover-target");

      let payload = JSON.parse(e.dataTransfer.getData("text/plain"));
      const srcPath = payload.path;
      if (!Array.isArray(srcPath)) return;

      const srcParentArr = getParentArrayByPath(srcPath);
      const srcIndex = srcPath[srcPath.length - 1];
      if (!srcParentArr || srcParentArr[srcIndex] == null) return;

      const movedNode = srcParentArr.splice(srcIndex, 1)[0];

      // prevent drop into self or descendant
      if (movedNode === node || isDescendant(movedNode, node)) {
        srcParentArr.splice(srcIndex, 0, movedNode);
        return;
      }

      node.children = node.children || [];
      node.children.push(movedNode);

      saveTemplate();
      renderFileTree(document.getElementById("fileTree"), currentTemplate.files);
    });
  }
}


/////////////////////
// Path utilities  //
/////////////////////
function findNodePath(targetNode, arr = currentTemplate.files, prefix = []) {
  if (!arr) return null;
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i];
    if (n === targetNode) return [...prefix, i];
    if (n.type === "folder" && n.children) {
      const sub = findNodePath(targetNode, n.children, [...prefix, i]);
      if (sub) return sub;
    }
  }
  return null;
}

function getParentArrayByPath(path) {
  if (!path) return null;
  if (path.length === 1) return currentTemplate.files;
  let arr = currentTemplate.files;
  for (let i = 0; i < path.length - 1; i++) {
    const idx = path[i];
    const node = arr[idx];
    if (!node || node.type !== "folder") return null;
    arr = node.children || [];
  }
  return arr;
}

function isDescendant(movedNode, possibleAncestor) {
  if (!possibleAncestor || possibleAncestor.type !== "folder") return false;
  const search = (node) => {
    if (node === movedNode) return true;
    if (node.type === "folder" && node.children) {
      for (const c of node.children) {
        if (search(c)) return true;
      }
    }
    return false;
  };
  if (!possibleAncestor.children) return false;
  for (const child of possibleAncestor.children) {
    if (search(child)) return true;
  }
  return false;
}

/////////////////////////////
// File open + editor sync //
/////////////////////////////
function openFile(file, el) {
  currentFile = file;
  const editorText = document.getElementById("editorText");
  const lineNumbers = document.getElementById("lineNumbers");
  const editorHeader = document.getElementById("openFileName");

  editorText.disabled = false; 
  editorText.value = file.content || "";
  updateLineNumbers(editorText, lineNumbers);

  editorHeader.innerText = file.name;

  document.querySelectorAll(".file-node").forEach((f) => f.classList.remove("active"));
  el.classList.add("active");
}


function updateLineNumbers(editorText, lineNumbers) {
  const lines = editorText.value.split("\n").length;
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
}
