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
  const varListEl = document.getElementById("variableList");
  const toggleVarListBtn = document.getElementById("toggleVarListBtn");
  const variableListHeader = document.getElementById("variableListHeader");
  const fileTreeEl = document.getElementById("fileTree");
  const editorText = document.getElementById("editorText");
  const lineNumbers = document.getElementById("lineNumbers");
  const addFileBtn = document.getElementById("addFileBtn");
  const addFolderBtn = document.getElementById("addFolderBtn");
  const addVarBtn = document.getElementById("addVarBtn");

  // --- Delete Project ---
  const deleteBtn = document.getElementById("deleteTemplateBtn");
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm("Delete this template?")) return;
      if (!confirm("Are you sure? This could alter templates saved in your projects.")) return;
      await deleteTemplate();
      window.location.href = "config.html";
    };
  }

  // Inline-edit template name
  titleEl.textContent = currentTemplate.name || "Untitled Template";
  titleEl.contentEditable = true;
  titleEl.spellcheck = false;
  titleEl.addEventListener("focus", () => {
    titleEl.classList.add("editing");
  });    
  titleEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      titleEl.blur();
    }
  });
  titleEl.addEventListener("blur", () => {
    titleEl.classList.remove("editing");
    currentTemplate.name = titleEl.textContent.trim();
    saveTemplate();
  });

  // Add variable button
  addVarBtn.onclick = async () => {
    // If collapsed, expand before adding
    if (varListEl.classList.contains("collapsed")) {
      varListEl.classList.remove("collapsed");
      toggleVarListBtn.textContent = "▼";
    }
  
    currentTemplate.variables.push({ name: "newVar" });
    saveTemplate();
    renderVariableList(
      varListEl,
      currentTemplate.variables,
      [currentTemplate.variables.length - 1],
      true // autofocus
    );
  };

  // Variable list toggle
  function toggleVariableList(e) {
    e.stopPropagation();
    varListEl.classList.toggle("collapsed");
    toggleVarListBtn.textContent = varListEl.classList.contains("collapsed") ? "▶" : "▼";
  }
  
  // ✅ Click anywhere on header (arrow + text)
  variableListHeader.onclick = toggleVariableList;  
  toggleVarListBtn.onclick = toggleVariableList;


  addFileBtn.onclick = () => {
    currentTemplate.files.push({ type: "file", name: "newfile.txt", content: "" });
    saveTemplate();
    const newEl = renderFileTree(fileTreeEl, currentTemplate.files, [currentTemplate.files.length - 1]);
    if (newEl) openFile(newEl.node, newEl.wrapper);
  };
  
  addFolderBtn.onclick = () => {
    const newFolder = { type: "folder", name: "New Folder", children: [] };
    currentTemplate.files.push(newFolder);
    saveTemplate();
    renderFileTree(fileTreeEl, currentTemplate.files, [currentTemplate.files.length - 1]);
  };

  editorText.addEventListener("scroll", () => {
    lineNumbers.scrollTop = editorText.scrollTop;
  });  

  // Editor auto-save
  editorText.addEventListener("input", () => {
    if (currentFile) {
      currentFile.content = editorText.value;
      updateLineNumbers(editorText, lineNumbers);
      saveTemplate();
    }
  });

  renderFileTree(fileTreeEl, currentTemplate.files || []);
  renderVariableList(varListEl, currentTemplate.variables || []);
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
  if (!currentTemplateId) return;
  const data = await storageGet("template");
  const templates = data.template || {};
  delete templates[currentTemplateId];
  await storageSet({ template: templates });
  await renderTemplates(); // refresh sidebar
}

/////////////////////////////
// File tree manipulation  //
/////////////////////////////
function renderVariableList(container, nodes, focusPath = null, isNew = false) {
  container.innerHTML = "";

  nodes.forEach((v, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "variable-node";

    const nameSpan = Object.assign(document.createElement("span"), {
      className: "variable-name",
      textContent: v.name,
      contentEditable: true,
      spellcheck: false,
    });
    nameSpan.addEventListener("focus", () => {
      wrapper.classList.add("editing");
    });    
    nameSpan.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameSpan.blur();
      }
    });
    nameSpan.addEventListener("blur", () => {
      wrapper.classList.remove("editing");
      v.name = nameSpan.textContent.trim();
      saveTemplate();
    });

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "variable-delete-btn";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.onclick = () => {
      if (confirm(`Delete "${v.name}"? This cannot be undone.`)) {
        nodes.splice(idx, 1);
        saveTemplate();
        renderVariableList(document.getElementById("variableList"), currentTemplate.variables || []);
      }
    };

    wrapper.append(nameSpan, deleteBtn);
    container.appendChild(wrapper);

    // ✅ Autofocus new variable
    if (isNew && idx === nodes.length - 1) {
      requestAnimationFrame(() => {
        nameSpan.focus();
        const range = document.createRange();
        range.selectNodeContents(nameSpan);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });
    }
  });
}


function renderFileTree(container, nodes, focusPath = null) {
  container.innerHTML = "";
  let newEl = null;

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
    const isNew = focusPath && focusPath.length === 1 && focusPath[0] === index;
    const { wrapper, nameSpan } = createFileNodeElement(node, nodes, index, isNew);
    container.appendChild(wrapper);

    if (isNew && nameSpan) {
      requestAnimationFrame(() => {
        nameSpan.focus();
        const range = document.createRange();
        range.selectNodeContents(nameSpan);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });

      newEl = { wrapper, node }; // store for opening later
    }
  });

  return newEl;
}


function createFileNodeElement(node, parentArray, index, isNew = false) {
  const wrapper = document.createElement("div");
  const nameSpan = Object.assign(document.createElement("span"), {
    className: "file-name",
    textContent: node.name,
    contentEditable: true,
    spellcheck: false,
  });
  nameSpan.setAttribute("placeholder", "Untitled");
  nameSpan.addEventListener("focus", () => {
    wrapper.classList.add("editing");
  });
  nameSpan.addEventListener("click", e => e.stopPropagation());
  nameSpan.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Optional: prevent newline
      nameSpan.blur();    // Triggers the blur handler below
    }
  });
  
  nameSpan.addEventListener("blur", () => {
    wrapper.classList.remove("editing");
    node.name = nameSpan.textContent.trim();
    saveTemplate();
  
    // If this is the current file, update editor header
    if (node === currentFile) {
      const editorHeader = document.getElementById("openFileName");
      editorHeader.innerText = currentFile.name + ": The format to insert a variable is \"$\\[varname]/$\"";
    }
  });

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
  

  if (node.type === "folder") {
    wrapper.className = "folder-item";

    const header = Object.assign(document.createElement("div"), { className: "folder-header" });
    const arrow = Object.assign(document.createElement("span"), {
      className: "arrow",
      textContent: node.open ? "▼" : "▶",
    });

    const toggleOpen = (e) => {
      e.stopPropagation();
      node.open = !node.open;
      saveTemplate();
      renderFileTree(document.getElementById("fileTree"), currentTemplate.files || []);
    };

    header.onclick = arrow.onclick = toggleOpen;
    header.append(arrow, nameSpan, deleteBtn);
    setupDragAndDrop(header, node);

    const childrenContainer = Object.assign(document.createElement("div"), { className: "folder-children" });
    if (node.open) renderFileTree(childrenContainer, node.children || []);

    wrapper.append(header, childrenContainer);
  } else {
    wrapper.className = "file-node";
    wrapper.append(nameSpan, deleteBtn);
    wrapper.addEventListener("click", () => openFile(node, wrapper));
    setupDragAndDrop(wrapper, node);
  }

  return { wrapper, nameSpan };
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

  editorHeader.innerText = file.name + ": The format to insert a variable is \"$\\[varname]/$\"";

  document.querySelectorAll(".file-node").forEach((f) => f.classList.remove("active"));
  el.classList.add("active");
}


function updateLineNumbers(editorText, lineNumbers) {
  const lines = editorText.value.split("\n").length;
  lineNumbers.textContent = Array.from({ length: lines + 5}, (_, i) => i + 1).join("\n");
}