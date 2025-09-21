document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const preselectProjectId = params.get("projectId");

  restoreSidebarState();

  renderProjects(preselectProjectId);
  renderTemplates();
  renderArchived();
  setupImportExport();
  setupCollapsibles();

  // attach buttons
  addTemplateButtonHandler();
  importExportButtonHandler();
});

async function loadView(type, id) {
  const main = document.querySelector(".main");

  let url = "";
  if (type === "project") url = "project.html";
  if (type === "template") url = "template.html";

  if (!url) return;

  const res = await fetch(url);
  const html = await res.text();
  main.innerHTML = html;

  if (type === "project") {
    const { initProjectView } = await import("./project.js");
    initProjectView(id);
  } else if (type === "template") {
    const { initTemplateView } = await import("./template.js");
    initTemplateView(id);
  }
}

/* ----------------------------
   Render Projects
----------------------------- */
function renderProjects(preselectProjectId) {
  chrome.storage.local.get("configProjects", (data) => {
    const projects = data.configProjects || {};
    const projectListEl = document.getElementById("config-projectList");
    projectListEl.innerHTML = "";

    for (const projectId in projects) {
      const project = projects[projectId];
      const item = createSidebarItem(
        project.name,
        () => loadView("project", projectId),
        () => archiveProject(projectId, project)
      );
      projectListEl.appendChild(item);

      // AUTO-OPEN if preselect matches
      if (preselectProjectId && preselectProjectId === projectId) {
        loadView("project", projectId);
      }
    }
  });
}

/* ----------------------------
   Render Templates
----------------------------- */
function renderTemplates() {
  chrome.storage.local.get("template", (data) => {
    const templates = data.template || {};
    const templateListEl = document.getElementById("templateList");
    templateListEl.innerHTML = "";

    for (const templateId in templates) {
      const template = templates[templateId];
      const item = createSidebarItem(
        template.name,
        () => loadView("template", templateId),
        null // no archive/unarchive for templates
      );
      templateListEl.appendChild(item);
    }

    // Add Template button
    const addTemplateBtn = document.getElementById("addTemplateBtn");
    addTemplateBtn.addEventListener("click", async () => {
      // Create a new template ID
      const id = `template-${Date.now()}`;
      const newTemplate = { name: "New Template", content: "" };

      // Save to storage
      chrome.storage.local.get("template", (data) => {
        const templates = data.template || {};
        templates[id] = newTemplate;
        chrome.storage.local.set({ template: templates }, () => {
          // Refresh template list and open the new template in main
          renderTemplates();
          loadView("template", id);
        });
      });
    });
  });
}

/* ----------------------------
   Render Archived
----------------------------- */
function renderArchived() {
  chrome.storage.local.get("archive", (data) => {
    const archived = data.archive || {};
    const archivedListEl = document.getElementById("archivedList");
    archivedListEl.innerHTML = "";

    for (const projectId in archived) {
      const project = archived[projectId];
      const item = createSidebarItem(
        project.name,
        () => loadView("project", projectId),
        () => unarchiveProject(projectId, project)
      );
      archivedListEl.appendChild(item);
    }
  });
}

/* ----------------------------
   Sidebar Item Factory
----------------------------- */
function createSidebarItem(name, onClick, onSecondary) {
  const container = document.createElement("div");
  container.className = "project-link";

  const span = document.createElement("span");
  span.textContent = name;
  span.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  container.appendChild(span);

  if (onSecondary) {
    const btn = document.createElement("button");
    btn.textContent = "📦";
    btn.style.marginLeft = "8px";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSecondary();
    });
    container.appendChild(btn);
  }

  return container;
}

/* ----------------------------
   Archive/Unarchive
----------------------------- */
function archiveProject(projectId, project) {
  chrome.storage.local.get(["configProjects", "archive"], (data) => {
    const projects = data.configProjects || {};
    const archived = data.archive || {};

    archived[projectId] = project;
    delete projects[projectId];

    chrome.storage.local.set({ configProjects: projects, archive: archived }, () => {
      renderProjects();
      renderArchived();
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
      renderProjects();
      renderArchived();
    });
  });
}


/* ----------------------------
   Import / Export
----------------------------- */
function setupImportExport() {
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");

  exportBtn.addEventListener("click", () => {
    chrome.storage.local.get(["configProjects", "archive", "template"], (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "overleaf-helper-backup.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  document.getElementById("importBtn").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const importedData = JSON.parse(text);
  
      // Merge each key separately
      for (const key of ["configProjects", "popProject", "archive", "template"]) {
        if (importedData[key]) {
          chrome.storage.local.get(key, (existing) => {
            const merged = { ...(existing[key] || {}), ...importedData[key] };
            chrome.storage.local.set({ [key]: merged });
          });
        }
      }
  
      alert("Data imported and merged successfully!");
      renderProjects();
      renderTemplates();
      renderArchived();
    };
    input.click();
  });
}

/* ----------------------------
   Collapsible Sidebar
----------------------------- */
function setupCollapsibles() {
  const headers = document.querySelectorAll(".sidebar-header");
  chrome.storage.local.get("sidebarState", (data) => {
    const state = data.sidebarState || {};

    headers.forEach((header) => {
      const key = header.dataset.toggle;
      const content = header.nextElementSibling;

      // restore
      if (state[key]) content.classList.add("open");

      header.addEventListener("click", () => {
        content.classList.toggle("open");
        state[key] = content.classList.contains("open");
        chrome.storage.local.set({ sidebarState: state });
      });
    });
  });
}
