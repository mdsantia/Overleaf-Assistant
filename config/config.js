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

/////////////////////
// storage helpers //
/////////////////////
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

let loadingView = false;
let activeSelection = null; // { type, id }

//////////////////////////////
// DOMContentLoaded (init)  //
//////////////////////////////
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const preselectProjectId = params.get("projectId");

  // Render lists (await to keep ordering predictable)
  await renderProjects(preselectProjectId);
  await renderTemplates();
  await renderArchived();

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
});

////////////////////////////
// Sidebar rendering APIs //
////////////////////////////

export async function renderProjects(preselectProjectId = null) {
  const data = await storageGet("configProjects");
  const projects = data.configProjects || {};
  const projectListEl = document.getElementById("config-projectList");
  if (!projectListEl) return;
  projectListEl.innerHTML = "";

  for (const projectId of Object.keys(projects)) {
    const project = projects[projectId];
    const item = createSidebarItem(
      project.name,
      "project",
      projectId,
      async () => { await archiveProject(projectId, project); }
    );
    projectListEl.appendChild(item);
  }

  updateSidebarActiveClasses();

  if (preselectProjectId && projects[preselectProjectId]) {
    const el = document.querySelector(`.project-link[data-type="project"][data-id="${preselectProjectId}"]`);
    await handleSelection("project", preselectProjectId, el);
  }
}

export async function renderTemplates() {
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
      null
    );
    templateListEl.appendChild(item);
  }

  updateSidebarActiveClasses();
}

export async function renderArchived() {
  const data = await storageGet("archive");
  const archived = data.archive || {};
  const archivedListEl = document.getElementById("archivedList");
  if (!archivedListEl) return;
  archivedListEl.innerHTML = "";

  for (const archivedId of Object.keys(archived)) {
    const project = archived[archivedId];
    const item = createSidebarItem(
      project.name,
      "archived",
      archivedId,
      async () => { await unarchiveProject(archivedId, project); }
    );
    archivedListEl.appendChild(item);
  }

  updateSidebarActiveClasses();
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
    handleSelection(type, id, container);
  });

  // Secondary button
  let secondaryBtn = null;

  if (type === "template") {
    // DELETE button with double confirmation
    secondaryBtn = document.createElement("button");
    secondaryBtn.textContent = "🗑️";
    secondaryBtn.title = "Delete template";
    secondaryBtn.style.marginLeft = "8px";
    secondaryBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this template?")) return;
      if (!confirm("Really delete? This cannot be undone!")) return;

      const data = await storageGet("template");
      const templates = data.template || {};
      delete templates[id];
      await storageSet({ template: templates });

      if (activeSelection && activeSelection.type === "template" && activeSelection.id === id) {
        activeSelection = null;
        const main = document.querySelector(".main");
        if (main) main.innerHTML = "";
      }

      await renderTemplates();
    });
  } else if (type === "archived") {
    // Unbox button
    secondaryBtn = document.createElement("button");
    secondaryBtn.textContent = "📤";
    secondaryBtn.title = "Unarchive";
    secondaryBtn.style.marginLeft = "8px";
    secondaryBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const data = await storageGet(["configProjects", "archive"]);
      const projects = data.configProjects || {};
      const archived = data.archive || {};
      const project = archived[id];
      if (!project) return;

      projects[id] = project;
      delete archived[id];
      await storageSet({ configProjects: projects, archive: archived });

      if (activeSelection && activeSelection.type === "archived" && activeSelection.id === id) {
        activeSelection = null;
        const main = document.querySelector(".main");
        if (main) main.innerHTML = "";
      }

      await renderProjects();
      await renderArchived();
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
      await renderProjects();
      await renderArchived();

      if (activeSelection && activeSelection.type === type && activeSelection.id === id) {
        activeSelection = null;
        const main = document.querySelector(".main");
        if (main) main.innerHTML = "";
      }
      updateSidebarActiveClasses();
    });
  }

  if (secondaryBtn) container.appendChild(secondaryBtn);
  return container;
}

/////////////////////////
// Selection & loading //
/////////////////////////
async function handleSelection(type, id, container = null, focusTitle = false) {
  if (loadingView) return;

  if (activeSelection && activeSelection.type === type && activeSelection.id === id) {
    return;
  }

  const previousSelection = activeSelection;
  activeSelection = { type, id };
  updateSidebarActiveClasses();

  loadingView = true;
  if (container) container.classList.add("loading");

  try {
    await loadView(type, id);

    // ✅ Focus template title if requested
    if (type === "template" && focusTitle) {
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
  } catch (err) {
    console.error("Error loading view:", err);
    activeSelection = previousSelection;
    updateSidebarActiveClasses();
  } finally {
    if (container) container.classList.remove("loading");
    loadingView = false;
  }
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
async function archiveProject(projectId, project) {
  const data = await storageGet(["configProjects", "archive"]);
  const projects = data.configProjects || {};
  const archived = data.archive || {};
  archived[projectId] = project;
  delete projects[projectId];
  await storageSet({ configProjects: projects, archive: archived });

  // If the archived project was open, clear view & activeSelection
  if (activeSelection && activeSelection.type === "project" && activeSelection.id === projectId) {
    activeSelection = null;
    const main = document.querySelector(".main");
    if (main) main.innerHTML = "";
  }

  await renderProjects();
  await renderArchived();
}

async function unarchiveProject(projectId, project) {
  const data = await storageGet(["configProjects", "archive"]);
  const projects = data.configProjects || {};
  const archived = data.archive || {};
  projects[projectId] = project;
  delete archived[projectId];
  await storageSet({ configProjects: projects, archive: archived });

  // If unarchived item was active in archived view, keep it cleared
  if (activeSelection && activeSelection.type === "archived" && activeSelection.id === projectId) {
    activeSelection = null;
    const main = document.querySelector(".main");
    if (main) main.innerHTML = "";
  }

  await renderProjects();
  await renderArchived();
}

/////////////////////////////
// Import / Export (kept) //
/////////////////////////////
function setupImportExport() {
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");

  if (exportBtn) {
    exportBtn.onclick = async () => {
      const data = await storageGet(["configProjects", "archive", "template"]);
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
        for (const key of ["configProjects", "archive", "template"]) {
          if (importedData[key]) {
            const existing = await storageGet(key);
            const merged = { ...(existing[key] || {}), ...importedData[key] };
            await storageSet({ [key]: merged });
          }
        }
        // re-render everything after import
        await renderProjects();
        await renderTemplates();
        await renderArchived();
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

  await renderTemplates();

  const el = document.querySelector(`.project-link[data-type="template"][data-id="${id}"]`);
  if (el) {
    // ✅ Pass true to indicate autofocus
    await handleSelection("template", id, el, true);
  } else {
    await handleSelection("template", id, null, true);
  }
}

//////////////////////
// Load view (page) //
//////////////////////
export async function loadView(type, id) {
  const main = document.querySelector(".main");
  let url = "";
  if (type === "project") url = "project.html";
  if (type === "template") url = "template.html";
  if (type === "archived") url = "project.html"; // archived uses project read-only view

  if (!url) return;

  // fetch html and inject
  const res = await fetch(url, { cache: "no-cache" });
  const html = await res.text();
  main.innerHTML = html;

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
  }

  // ensure active class remains correct (the DOM changed)
  updateSidebarActiveClasses();
}
