// sidebar.js (updated)

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

/* ----------------------------
   DOMContentLoaded (init)
----------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const preselectProjectId = params.get("projectId");

  // Render lists (await to keep ordering predictable)
  await renderProjects(preselectProjectId);
  await renderTemplates();
  await renderArchived();

  // Collapsible state should be wired after the content exists
  setupCollapsibles();
  await restoreSidebarState(); // apply stored open state

  setupImportExport();

  // buttons
  const addTemplateBtn = document.getElementById("addTemplateBtn");
  if (addTemplateBtn) {
    addTemplateBtn.addEventListener("click", () => createNewTemplate());
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

  for (const projectId in projects) {
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

  for (const templateId in templates) {
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

  for (const projectId in archived) {
    const project = archived[projectId];
    const item = createSidebarItem(
      project.name,
      "archived",
      projectId,
      async () => { await unarchiveProject(projectId, project); }
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

  // Primary click (open view)
  container.addEventListener("click", (e) => {
    // If button was clicked, ignore here — its own handler will run.
    if (e.target.tagName === "BUTTON") return;
    // handleSelection is async but we don't `await` here intentionally
    // so clicks are responsive; handleSelection itself prevents overlap.
    handleSelection(type, id, container);
  });

  if (onSecondary) {
    const btn = document.createElement("button");
    btn.textContent = "📦";
    btn.style.marginLeft = "8px";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      // allow secondary action to run, then re-render lists
      await onSecondary();
      await renderProjects();
      await renderArchived();
      // If the archived/unarchived item was the active one, clear it
      if (activeSelection && activeSelection.type === type && activeSelection.id === id) {
        activeSelection = null;
        const main = document.querySelector(".main");
        if (main) main.innerHTML = "";
      }
      updateSidebarActiveClasses();
    });
    container.appendChild(btn);
  }

  return container;
}

/////////////////////////
// Selection & loading //
/////////////////////////
async function handleSelection(type, id, container = null) {
  // If already loading, ignore additional requests
  if (loadingView) return;

  // If the clicked item is already active, just return (idempotent)
  if (activeSelection && activeSelection.type === type && activeSelection.id === id) {
    return;
  }

  loadingView = true;
  if (container) container.classList.add("loading");

  try {
    await loadView(type, id);
    activeSelection = { type, id };
    updateSidebarActiveClasses();
  } catch (err) {
    console.error("Error loading view:", err);
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

  // If the archived project was open, clear view
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
  const newTemplate = { name: "New Template", content: "" };

  const data = await storageGet("template");
  const templates = data.template || {};
  templates[id] = newTemplate;
  await storageSet({ template: templates });

  await renderTemplates();
  // find the new element in the sidebar and open it
  const el = document.querySelector(`.project-link[data-type="template"][data-id="${id}"]`);
  await handleSelection("template", id, el);
}

//////////////////////
// Load view (page) //
//////////////////////
export async function loadView(type, id) {
  const main = document.querySelector(".main");
  let url = "";
  if (type === "project") url = "project.html";
  if (type === "template") url = "template.html";
  if (type === "archived") url = "project.html"; // read-only view

  if (!url) return;
  const res = await fetch(url, { cache: "no-cache" });
  const html = await res.text();
  main.innerHTML = html;

  if (type === "project") {
    const { initProjectView } = await import("./project.js");
    // initProjectView may be async — wait for it
    await initProjectView(id, false);
  } else if (type === "template") {
    const { initTemplateView } = await import("./template.js");
    await initTemplateView(id);
  } else if (type === "archived") {
    const { initProjectView } = await import("./project.js");
    await initProjectView(id, true); // read-only
  }
}
