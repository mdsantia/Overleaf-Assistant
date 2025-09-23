// config.js
// Use module so we can import project/template modules if needed later.

function restoreSidebarState() {
  // no-op / reserved for persistence later
}

/* ----------------------------
   Load a view fragment and initialize it
   (fetch HTML fragment and then import the corresponding JS)
---------------------------- */
async function loadView(type, id) {
  const main = document.getElementById("main-view");
  let url = "";
  if (type === "project") url = "project.html";
  if (type === "template") url = "template.html";
  if (!url) return;

  try {
    const res = await fetch(url);
    const html = await res.text();
    main.innerHTML = html;

    if (type === "project") {
      const { initProjectView } = await import("./project.js");
      initProjectView(id);
    } else if (type === "template") {
      const { initTemplateView } = await import("./template.js");
      initTemplateView(id, () => {
        // after delete - return to default main view
        renderAll();
      });
    }
  } catch (err) {
    console.error("Failed loading view:", err);
  }
}

/* ----------------------------
   RENDER HELPERS
---------------------------- */
function clearActiveIn(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll(".sidebar-item").forEach(el => el.classList.remove("active"));
}

function createSidebarItem(text, onClick, secondaryEl = null) {
  const item = document.createElement("div");
  item.className = "sidebar-item";

  const left = document.createElement("span");
  left.textContent = text;
  left.style.flex = "1";
  item.appendChild(left);

  if (secondaryEl) {
    item.appendChild(secondaryEl);
  }

  item.addEventListener("click", (e) => {
    // avoid the click from also triggering when user presses secondary button
    if (e.target !== secondaryEl) {
      onClick();
      // visual active state
      clearActiveIn("projects-list");
      clearActiveIn("templates-list");
      clearActiveIn("archived-list");
      item.classList.add("active");
    }
  });

  return item;
}

/* ----------------------------
   Render lists from storage
---------------------------- */
function renderProjects(preselectId, projects = {}) {
  const container = document.getElementById("projects-list");
  if (!container) return;
  container.innerHTML = "";

  const entries = Object.entries(projects || {});
  if (entries.length === 0) {
    const p = document.createElement("div");
    p.className = "muted";
    p.textContent = "No projects saved.";
    container.appendChild(p);
    return;
  }

  entries.forEach(([id, project]) => {
    const archiveBtn = document.createElement("button");
    archiveBtn.textContent = "📦";
    archiveBtn.title = "Archive";
    archiveBtn.style.marginLeft = "8px";
    archiveBtn.onclick = (ev) => {
      ev.stopPropagation();
      archiveProject(id, project);
    };

    const item = createSidebarItem(project.name || "Untitled Project", () => loadView("project", id), archiveBtn);
    container.appendChild(item);

    if (preselectId && preselectId === id) {
      // mark active and open
      item.classList.add("active");
      loadView("project", id);
    }
  });
}

function renderTemplates(templates = {}) {
  const container = document.getElementById("templates-list");
  if (!container) return;
  container.innerHTML = "";

  const entries = Object.entries(templates || {});
  if (entries.length === 0) {
    const p = document.createElement("div");
    p.className = "muted";
    p.textContent = "No templates saved.";
    container.appendChild(p);
    return;
  }

  entries.forEach(([id, tpl]) => {
    const item = createSidebarItem(tpl.name || "Untitled Template", () => loadView("template", id));
    container.appendChild(item);
  });

  // add-template is handled by its own button in HTML
}

function renderArchived(archived = {}) {
  const container = document.getElementById("archived-list");
  if (!container) return;
  container.innerHTML = "";

  const entries = Object.entries(archived || {});
  if (entries.length === 0) {
    const p = document.createElement("div");
    p.className = "muted";
    p.textContent = "No archived items.";
    container.appendChild(p);
    return;
  }

  entries.forEach(([id, entry]) => {
    const unarchiveBtn = document.createElement("button");
    unarchiveBtn.textContent = "↩";
    unarchiveBtn.title = "Unarchive";
    unarchiveBtn.onclick = (ev) => {
      ev.stopPropagation();
      unarchiveProject(id, entry);
    };

    const item = createSidebarItem(entry.name || "Untitled", () => loadView("project", id), unarchiveBtn);
    container.appendChild(item);
  });
}

/* ----------------------------
   Archive/Unarchive
---------------------------- */
function archiveProject(projectId, project) {
  chrome.storage.local.get(["configProjects", "archive"], (data) => {
    const projects = data.configProjects || {};
    const archived = data.archive || {};

    archived[projectId] = project;
    delete projects[projectId];

    chrome.storage.local.set({ configProjects: projects, archive: archived }, () => {
      renderAll();
      // if the archived project is currently open we reset main view
      const main = document.getElementById("main-view");
      main.innerHTML = `<div class="config-section"><h2>Item archived</h2><p class="muted">That project was archived.</p></div>`;
    });
  });
}

function unarchiveProject(projectId, project) {
  chrome.storage.local.get(["configProjects", "archive"], (data) => {
    const projects = data.configProjects || {};
    const archived = data.archive || {};

    projects[projectId] = project;
    delete archived[projectId];

    chrome.storage.local.set({ configProjects: projects, archive: archived }, () => {
      renderAll();
    });
  });
}

/* ----------------------------
   Import / Export - single handlers (no dupes)
---------------------------- */
function setupImportExport() {
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const addTemplateBtn = document.getElementById("add-template-btn");

  // ensure we don't double attach — assign handlers directly
  if (exportBtn) {
    exportBtn.onclick = () => {
      // disable quickly to avoid double clicks while creating blob
      exportBtn.disabled = true;
      chrome.storage.local.get(null, (items) => {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "overleaf-helper-backup.json";
        a.click();
        URL.revokeObjectURL(url);
        exportBtn.disabled = false;
      });
    };
  }

  if (importBtn) {
    importBtn.onclick = () => {
      importBtn.disabled = true;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) { importBtn.disabled = false; return; }
        try {
          const text = await file.text();
          const importedData = JSON.parse(text);

          // merge keys of interest
          const keys = ["configProjects", "archive", "template"];
          for (const key of keys) {
            if (importedData[key]) {
              chrome.storage.local.get([key], (existing) => {
                const merged = { ...(existing[key] || {}), ...importedData[key] };
                chrome.storage.local.set({ [key]: merged });
              });
            }
          }

          // small delay to ensure storage writes
          setTimeout(() => {
            renderAll();
            importBtn.disabled = false;
            alert("Data imported and merged successfully!");
          }, 200);
        } catch (err) {
          console.error("Import error:", err);
          importBtn.disabled = false;
          alert("Import failed: invalid JSON");
        }
      };
      input.click();
    };
  }

  // add template btn
  if (addTemplateBtn) {
    addTemplateBtn.onclick = () => {
      addTemplateBtn.disabled = true;
      const id = `template-${Date.now()}`;
      const newTemplate = { name: "New Template", content: "" };
      chrome.storage.local.get(["template"], (data) => {
        const templates = data.template || {};
        templates[id] = newTemplate;
        chrome.storage.local.set({ template: templates }, () => {
          renderAll();
          loadView("template", id);
          addTemplateBtn.disabled = false;
        });
      });
    };
  }
}

/* ----------------------------
   Collapsible behavior (visual only)
---------------------------- */
function setupCollapsibles() {
  document.querySelectorAll(".sidebar-header").forEach(header => {
    header.onclick = () => {
      const parent = header.closest(".sidebar-section");
      parent.classList.toggle("collapsed");
    };
  });
}

/* ----------------------------
   render everything from storage
---------------------------- */
function renderAll(preselectProjectId) {
  chrome.storage.local.get(["configProjects", "template", "archive"], (result) => {
    const projects = result.configProjects || {};
    const templates = result.template || {};
    const archived = result.archive || {};

    renderProjects(preselectProjectId, projects);
    renderTemplates(templates);
    renderArchived(archived);
  });
}

/* ----------------------------
   Init on load
---------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  restoreSidebarState?.();

  const params = new URLSearchParams(window.location.search);
  const preselectProjectId = params.get("projectId");

  renderAll(preselectProjectId);
  setupImportExport();
  setupCollapsibles();

  // if preselect provided, attempt to load it (renderAll will also mark active)
  if (preselectProjectId) {
    // small timeout to ensure renderAll has placed items
    setTimeout(() => loadView("project", preselectProjectId), 120);
  }
});
