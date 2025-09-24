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

  // DOM refs
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
  nodes.forEach((node, index) => {
    const el = createFileNodeElement(node, nodes, index);
    container.appendChild(el);
  });
}

function createFileNodeElement(node, parentArray, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "file-node";

  // Folder toggle
  if (node.type === "folder") {
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = node.open ? "▼" : "▶";
    arrow.onclick = () => {
      node.open = !node.open;
      renderFileTree(wrapper.nextSibling, node.children || []);
      arrow.textContent = node.open ? "▼" : "▶";
      saveTemplate();
    };
    wrapper.appendChild(arrow);
  }

  // Name label (inline editable)
  const nameSpan = document.createElement("span");
  nameSpan.className = "file-name";
  nameSpan.textContent = node.name;
  nameSpan.contentEditable = true;
  nameSpan.spellcheck = false;
  nameSpan.addEventListener("input", () => {
    node.name = nameSpan.textContent;
    saveTemplate();
  });
  nameSpan.addEventListener("click", () => {
    if (node.type === "file") openFile(node, nameSpan);
  });
  wrapper.appendChild(nameSpan);

  // Context menu
  const menuBtn = document.createElement("button");
  menuBtn.className = "menu-btn";
  menuBtn.textContent = "⋮";
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    const action = prompt("Type 'rename' or 'delete':");
    if (action === "delete") {
      parentArray.splice(index, 1);
      saveTemplate();
      renderFileTree(wrapper.parentElement, parentArray);
    } else if (action === "rename") {
      const newName = prompt("New name:", node.name);
      if (newName) {
        node.name = newName;
        saveTemplate();
        renderFileTree(wrapper.parentElement, parentArray);
      }
    }
  };
  wrapper.appendChild(menuBtn);

  // Child list for folders
  const childrenContainer = document.createElement("div");
  childrenContainer.className = "file-children";
  if (node.type === "folder" && node.open) {
    renderFileTree(childrenContainer, node.children || []);
  }

  // Drag/drop
  setupDragAndDrop(wrapper, node, parentArray, index);

  const fragment = document.createDocumentFragment();
  fragment.appendChild(wrapper);
  if (node.type === "folder") fragment.appendChild(childrenContainer);
  return fragment;
}

/////////////////////////////
// Drag and Drop behavior  //
/////////////////////////////
function setupDragAndDrop(el, node, parentArray, index) {
  el.draggable = true;
  el.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ node, parentArray, index }));
    el.classList.add("dragging");
  });
  el.addEventListener("dragend", () => {
    el.classList.remove("dragging");
    document.querySelectorAll(".hover-target").forEach((h) => h.classList.remove("hover-target"));
  });

  if (node.type === "folder") {
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.classList.add("hover-target");
    });
    el.addEventListener("dragleave", () => {
      el.classList.remove("hover-target");
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("hover-target");
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (!data) return;

      // remove from old parent
      data.parentArray.splice(data.index, 1);
      node.children = node.children || [];
      node.children.push(data.node);

      saveTemplate();
      const container = el.nextSibling;
      renderFileTree(container, node.children);
    });
  }
}

/////////////////////////////
// File open + editor sync //
/////////////////////////////
function openFile(file, el) {
  currentFile = file;
  const editorText = document.getElementById("editorText");
  const lineNumbers = document.getElementById("lineNumbers");
  editorText.value = file.content || "";
  updateLineNumbers(editorText, lineNumbers);

  document.querySelectorAll(".file-name").forEach((f) => f.classList.remove("active"));
  el.classList.add("active");
}

function updateLineNumbers(editorText, lineNumbers) {
  const lines = editorText.value.split("\n").length;
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
}
