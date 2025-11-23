// config.js (complete, improved)
//
// Responsibilities:
// - render Projects / Templates / Archived lists
// - handle selection and optimistic active highlighting (applies to projects, templates, archived)
// - archive / unarchive projects
// - import / export
// - persist collapsible sidebar state
// - create new template and immediately open it
//

import downloadFilesAsZip from "../template-generation/downloadFilesAsZip.js";
import unzipTemplate from "../template-generation/zipAsFiles.js";

/////////////////////
// storage helpers //
/////////////////////
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

let activeSelection = null; // { type, id }

//////////////////////////////
// DOMContentLoaded (init)  //
//////////////////////////////
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("projectId");
  const templateId = params.get("templateId");
  const newTemplate = params.get("newTemplate");

  // Render lists (await to keep ordering predictable)
  const isArchived = await renderProjects(projectId);
  await renderTemplates(templateId);

  // Wire collapsibles and restore state
  await setupCollapsibles();
  await restoreSidebarState();

  setupImportExport();

  // Add template button (if present)
  const addTemplateBtn = document.getElementById("addTemplateBtn");
  if (addTemplateBtn) {
    addTemplateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      createNewTemplate();
    });
  }
  const settingsButton = document.getElementById("settingsBtn")
  if (settingsButton) {
    settingsButton.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = chrome.runtime.getURL("/config/config.html");
    });
  }

  const id = projectId ? projectId : templateId;
  const datatype = isArchived ? "archived" : 
  (projectId ? "project" : (templateId ? "template" : null));
  if (datatype !== null) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "file_editor.css";
    document.querySelector(".main").appendChild(link);
  }
  await loadView(datatype, id);

  // ✅ Focus template title if requested
  if (newTemplate) {
    const titleEl = document.getElementById("templateTitle");
    if (titleEl) {
      titleEl.focus();
      const range = document.createRange();
      range.selectNodeContents(titleEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
});

////////////////////////////
// Sidebar rendering APIs //
////////////////////////////

export async function renderProjects(projectId = null) {
  const data = await storageGet("configProjects");
  const projects = data.configProjects || {};
  const projectListEl = document.getElementById("config-projectList");
  const archivedListEl = document.getElementById("archivedList");
  if (!projectListEl || !archivedListEl) return;
  projectListEl.innerHTML = "";
  archivedListEl.innerHTML = "";

  for (const projectId of Object.keys(projects)) {
    const project = projects[projectId];
    const item = createSidebarItem(
      project.name,
      project.archived ? "archived" : "project",
      projectId,
      async () => { await un_archiveProject(projectId, project.archived); }
    );
    if (project.archived) {
      archivedListEl.appendChild(item);
    } else {
      projectListEl.appendChild(item);
    }
  }

  if (projectId) {
    if (!projects[projectId]) {
      window.location.href = chrome.runtime.getURL(`/config/config.html`);
    }
    return projects[projectId].archived;
  }
}

export async function renderTemplates(templateId) {
  const data = await storageGet("template");
  const templates = data.template || {};
  const templateListEl = document.getElementById("templateList");
  if (!templateListEl) return;
  templateListEl.innerHTML = "";

  for (const templateId of Object.keys(templates)) {
    const template = templates[templateId];
    const item = createSidebarItem(
      template.name,
      "template",
      templateId,
      async () => { await zipTemplate(template); }
    );
    templateListEl.appendChild(item);
  }

  if (templateId) {
    if (!templates[templateId]) {
      window.location.href = chrome.runtime.getURL(`/config/config.html`);
    }
  }
}

///////////////////////////
// Sidebar item factory //
///////////////////////////
function createSidebarItem(name, type, id, onSecondary) {
  const container = document.createElement("div");
  container.className = "project-link";
  container.dataset.type = type;
  container.dataset.id = id;

  const span = document.createElement("span");
  span.textContent = name;
  span.className = "project-link-name";
  container.appendChild(span);

  // Primary click opens view
  container.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") return;
    const linktype = type == "template" ? type : "project";
    window.location.href = chrome.runtime.getURL(`/config/config.html?${linktype}Id=${id}`);
  });

  // Secondary button
  let secondaryBtn = null;

  if (type === "template") {
    // DOWNLOAD button (ZIP export)
    secondaryBtn = document.createElement("button");
    // secondaryBtn.textContent = "⬇️";
    secondaryBtn.style.backgroundImage = `url(${chrome.runtime.getURL('icons/download-icon-128.png')})`;
    secondaryBtn.style.backgroundSize = 'contain';
    secondaryBtn.style.backgroundRepeat = 'no-repeat';
    secondaryBtn.style.backgroundPosition = 'center';
    secondaryBtn.textContent = ''; // Remove text
    secondaryBtn.title = "Download template as ZIP";
    secondaryBtn.style.marginLeft = "8px";
    secondaryBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await onSecondary();
    });
  } else if (type === "archived") {
    // Unbox button
    secondaryBtn = document.createElement("button");
    secondaryBtn.textContent = "📤";
    secondaryBtn.title = "Unarchive";
    secondaryBtn.style.marginLeft = "8px";
    secondaryBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await onSecondary();
    });
  } else if (onSecondary) {
    // default archive button for projects
    secondaryBtn = document.createElement("button");
    secondaryBtn.textContent = "📦";
    secondaryBtn.title = "Archive";
    secondaryBtn.style.marginLeft = "8px";
    secondaryBtn.addEventListener("click", async (e) => {  
      e.stopPropagation();
      await onSecondary();
    });
  }

  if (secondaryBtn) container.appendChild(secondaryBtn);
  return container;
}

function updateSidebarActiveClasses() {
  document.querySelectorAll(".project-link").forEach((el) => {
    const t = el.dataset.type;
    const i = el.dataset.id;
    if (activeSelection && activeSelection.type === t && activeSelection.id === i) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

//////////////////////////////
// Archive / Unarchive APIs //
//////////////////////////////
async function un_archiveProject(projectId, unarchive_bool) {
  const data = await storageGet(["configProjects"]);
  const projects = data.configProjects || {};
  if (unarchive_bool) {
    delete projects[projectId].archived;
  } else {
    projects[projectId].archived = true;
  }
  await storageSet({ configProjects: projects });

  // If the archived project was open, clear view & activeSelection
  if (activeSelection && activeSelection.id === projectId) {
    window.location.href = chrome.runtime.getURL(`/config/config.html?projectId=${projectId}`);
    return;
  }
  await renderProjects();
  await updateSidebarActiveClasses();
}

//////////////////////////////
//    ZIP TEMPLATE API      //
//////////////////////////////
async function zipTemplate(template) {
  try {
    // This WILL open the browser's local "Save file" dialog
    await downloadFilesAsZip(
      template.files,
      template.name
  );  
  } catch (err) {
    console.error("Failed to download ZIP:", err);
  }
}

async function handleZipUpload(fileInput) {
  const zipBlob = fileInput.files[0];

  const templateFiles = await unzipTemplate(zipBlob);

  console.log("Recovered template file tree:", templateFiles);

  // Now insert into your template storage system:
  await storageSet({
    template: {
      ...existingTemplates,
      [newId]: {
        name: "Imported Template",
        files: templateFiles
      }
    }
  });
}


/////////////////////////////
// Import / Export (kept) //
/////////////////////////////
function setupImportExport() {
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");

  if (exportBtn) {
    exportBtn.onclick = async () => {
      const data = await storageGet(["popProjects", "configProjects", "template", "command_customizations"]);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "overleaf-helper-backup.json";
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  if (importBtn) {
    importBtn.onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const importedData = JSON.parse(text);

        // merge keys
        for (const key of ["popProjects", "configProjects", "template", "command_customizations"]) {
          if (importedData[key]) {
            const existing = await storageGet(key);
            const merged = { ...(existing[key] || {}), ...importedData[key] };
            await storageSet({ [key]: merged });
          }
        }
        // re-render everything after import
        await renderProjects();
        await renderTemplates();
        alert("Data imported successfully!");
      };
      input.click();
    };
  }
}

/////////////////////////////////
// Collapsible sidebar support //
/////////////////////////////////
async function setupCollapsibles() {
  const headers = document.querySelectorAll(".sidebar-header");
  const data = await storageGet("sidebarState");
  const state = data.sidebarState || {};
  headers.forEach((header) => {
    const key = header.dataset.toggle;
    const content = header.nextElementSibling;
    if (!content) return;
    // apply initial state
    if (state[key]) content.classList.add("open");
    header.addEventListener("click", () => {
      content.classList.toggle("open");
      state[key] = content.classList.contains("open");
      chrome.storage.local.set({ sidebarState: state });
    });
  });
}

async function restoreSidebarState() {
  const data = await storageGet("sidebarState");
  const state = data.sidebarState || {};
  for (const key in state) {
    const header = document.querySelector(`.sidebar-header[data-toggle="${key}"]`);
    const content = header ? header.nextElementSibling : null;
    if (content && state[key]) {
      content.classList.add("open");
    }
  }
}

//////////////////////////////
// createNewTemplate helper //
//////////////////////////////
async function createNewTemplate() {
  const id = `template-${Date.now()}`;
  const newTemplate = { name: "New Template", files: [], variables: [], id };

  const data = await storageGet("template");
  const templates = data.template || {};
  templates[id] = newTemplate;
  await storageSet({ template: templates });

  window.location.href = chrome.runtime.getURL(`/config/config.html?templateId=${id}&newTemplate=true`);
}

//////////////////////
// Load view (page) //
//////////////////////
export async function loadView(type, id) {
  const main = document.querySelector(".main");
  let url = "";
  if (type) {
    switch(type) {
      case "template": url = "template.html"; break;
      case "project":
      case "archived":
        url = "project.html"; // archived uses project read-only view
        break;
      default:
        return;
      }
      // fetch html and inject
      const res = await fetch(url, { cache: "no-cache" });
      const html = await res.text();
      main.innerHTML = html;
  }

  // after injecting, call the appropriate initializer
  if (type === "project") {
    const { initProjectView } = await import("./project.js");
    await initProjectView(id, false);
  } else if (type === "template") {
    const { initTemplateView } = await import("./template.js");
    await initTemplateView(id);
  } else if (type === "archived") {
    const { initProjectView } = await import("./project.js");
    await initProjectView(id, true); // read-only
  } else {
    const main = document.querySelector(".main");
    const shortcutsSection = document.createElement("div");
    shortcutsSection.className = "config-section";
    shortcutsSection.innerHTML = `<h2>Keyboard Shortcuts</h2><div id="shortcutsList"></div>`;
    main.appendChild(shortcutsSection);

    const { command_customizations = {} } = await storageGet("command_customizations");
    const listEl = document.getElementById("shortcutsList");

    for (const [command, shortcut] of Object.entries(command_customizations)) {
      const row = document.createElement("div");
      row.className = "shortcut-row";

      const label = document.createElement("span");
      label.textContent = command;
      label.className = "shortcut-command";

      const keybind = document.createElement("span");
      keybind.textContent = formatShortcut(shortcut);
      keybind.className = "shortcut-key";

      const changeBtn = document.createElement("button");
      changeBtn.textContent = "Change";
      changeBtn.addEventListener("click", () => beginShortcutChange(command, keybind));

      row.appendChild(label);
      row.appendChild(keybind);
      row.appendChild(changeBtn);
      listEl.appendChild(row);
    }
    return;
  }

  // ensure active class remains correct (the DOM changed)
  activeSelection = {type, id};
  updateSidebarActiveClasses();
}

//////////////////////
// Shortcut helpers //
//////////////////////
function formatShortcut(shortcut) {
  const parts = [];
  if (shortcut.meta) parts.push("Meta");
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  parts.push((shortcut.key || '').toUpperCase());
  return parts.join(" + ");
}

function beginShortcutChange(command, keybindEl) {
  keybindEl.textContent = "Press new key...";
  keybindEl.classList.add("listening");

  const activeMods = new Set();

  function onKeyDown(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      cleanup();
      keybindEl.textContent = "Canceled";
      setTimeout(async () => {
        const data = await storageGet("command_customizations");
        keybindEl.textContent = formatShortcut(data.command_customizations[command]);
      }, 1500);
      return;
    }

    // Modifiers → show live preview
    if (isModifier(e.key)) {
      activeMods.add(e.key);
      keybindEl.textContent = formatLiveShortcut(activeMods);
      return;
    }

    // Final key pressed
    const newShortcut = {
      key: e.key,
      meta: activeMods.has("Meta") || e.metaKey,
      ctrl: activeMods.has("Control") || e.ctrlKey,
      alt: activeMods.has("Alt") || e.altKey,
      shift: activeMods.has("Shift") || e.shiftKey
    };

    storageGet("command_customizations").then(data => {
      const updated = { ...(data.command_customizations || {}) };

      const conflictCommand = findConflict(updated, newShortcut, command);
      if (conflictCommand) {
        keybindEl.textContent = `❌ Conflicts with: ${conflictCommand}`;
        keybindEl.classList.add("conflict");
        setTimeout(async () => {
          keybindEl.classList.remove("conflict", "listening");
          const data = await storageGet("command_customizations");
          keybindEl.textContent = formatShortcut(data.command_customizations[command]);
        }, 2000);
        cleanup();
        return;
      }

      updated[command] = newShortcut;
      storageSet({ command_customizations: updated }).then(() => {
        keybindEl.textContent = formatShortcut(newShortcut);
        keybindEl.classList.remove("listening");
        cleanup();
      });
    });
  }

  function onKeyUp(e) {
    if (isModifier(e.key)) {
      activeMods.delete(e.key);
      // Update the live display if the user releases modifiers
      keybindEl.textContent = formatLiveShortcut(activeMods);
    }
  }

  function cleanup() {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    activeMods.clear();
  }

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
}

function isModifier(key) {
  return key === "Shift" || key === "Control" || key === "Meta" || key === "Alt";
}

function formatLiveShortcut(activeMods) {
  if (activeMods.size === 0) return "Press new key...";
  return [...activeMods].join(" + ") + " + …";
}

function findConflict(commandsObj, newShortcut, currentCommand) {
  for (const [cmd, shortcut] of Object.entries(commandsObj)) {
    if (cmd === currentCommand) continue;
    if (isSameShortcut(shortcut, newShortcut)) {
      return cmd;
    }
  }
  return null;
}

function isSameShortcut(a, b) {
  return (
    a.key === b.key &&
    a.alt === b.alt &&
    a.ctrl === b.ctrl &&
    a.meta === b.meta &&
    a.shift === b.shift
  );
}
