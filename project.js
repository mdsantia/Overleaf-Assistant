// project.js
const STORAGE_KEYS = {
  projects: "configProjects",
  templates: "template",
  popProjects: "popProjects",
};

let currentProjectId = null;
let openVar = null;

/**
 * Initialize project view
 */
export async function initProjectView(projectId, readOnly = false) {
  currentProjectId = projectId;

  // refs
  const nameEl = document.getElementById("projectName");
  const popupShortcutEl = document.getElementById("popupShortcut");
  const localBackupToggleEl = document.getElementById("localBackupToggle");
  const backupFolderEl = document.getElementById("backupFolderSelect");
  const backupFolderInput = document.getElementById("backupParentFolder");
  const importTemplatesEl = document.getElementById("importTemplates");
  const popupCustomizationsEl = document.getElementById("popupCustomizations");

  const addTemplateUsageBtn = document.getElementById("addTemplateUsageBtn");
  const templateUsageList = document.getElementById("templateUsageList");

  const editorContent = document.getElementById("fileEditorContent");
  const saveVarBtn = document.getElementById("saveVarBtn");

  const deleteBtn = document.getElementById("deleteProjectBtn");

  // fetch fresh data
  const { configProjects = {} } = await chrome.storage.local.get(STORAGE_KEYS.projects);
  const { template = {} } = await chrome.storage.local.get(STORAGE_KEYS.templates);
  const { popProjects = {} } = await chrome.storage.local.get(STORAGE_KEYS.popProjects);

  const project = configProjects[projectId];
  if (!project) {
    nameEl.value = "Project not found";
    return;
  }

  // populate primary settings
  nameEl.value = project.name || "";
  popupShortcutEl.checked = !!popProjects[projectId];
  localBackupToggleEl.checked = !!project.localBackup;
  backupFolderInput.value = project.backupFolder || "";
  backupFolderEl.classList.toggle("hidden", !localBackupToggleEl.checked);

  // import templates multi-select
  importTemplatesEl.innerHTML = "";
  for (const tId in template) {
    const opt = document.createElement("option");
    opt.value = tId;
    opt.textContent = template[tId].name || tId;
    if ((project.importedTemplates || []).includes(tId)) opt.selected = true;
    importTemplatesEl.appendChild(opt);
  }

  // popup customizations (only if in popProjects)
  popupCustomizationsEl.classList.toggle("hidden", !popProjects[projectId]);
  if (popProjects[projectId]) {
    document.getElementById("openPdfToggle").checked = !!project.openPdfViewer;
    document.getElementById("showPdfButton").checked = !!project.showPdfButton;
    document.getElementById("autoAutoSaveToggle").checked = !!project.autoAutoSave;
  }

  // render template usages
  renderTemplateUsages(templateUsageList, project, template);

  // handlers
  localBackupToggleEl.onchange = () => {
    backupFolderEl.classList.toggle("hidden", !localBackupToggleEl.checked);
  };

  addTemplateUsageBtn.onclick = () => {
    // add first available template not yet used
    const unused = Object.keys(template).find(
      (tId) => !(project.templateUsages || {})[tId]
    );
    if (!unused) return alert("No unused templates available.");
    project.templateUsages = project.templateUsages || {};
    project.templateUsages[unused] = { variables: {} };
    saveProject(configProjects, projectId, project);
  };

  // file editor save
  saveVarBtn.onclick = () => {
    if (!openVar) return alert("No variable open.");
    const input = editorContent.querySelector("input, textarea");
    project.templateUsages[openVar.templateId].variables[openVar.key] = input.value;
    saveProject(configProjects, projectId, project, () => {
      alert("Variable saved.");
    });
  };

  // delete project
  deleteBtn.onclick = () => {
    if (!confirm("Delete this project?")) return;
    if (!confirm("Are you absolutely sure? This cannot be undone.")) return;
    delete configProjects[projectId];
    chrome.storage.local.set({ [STORAGE_KEYS.projects]: configProjects }, () => {
      alert("Project deleted.");
      // optional: refresh project list UI
    });
  };

  // save primary settings on blur/change
  function attachSaver(el, key, type = "value") {
    el.onchange = () => {
      if (type === "checked") project[key] = el.checked;
      else if (type === "array") {
        project[key] = Array.from(el.selectedOptions).map((o) => o.value);
      } else {
        project[key] = el.value;
      }
      saveProject(configProjects, projectId, project);
    };
  }
  attachSaver(nameEl, "name");
  attachSaver(localBackupToggleEl, "localBackup", "checked");
  attachSaver(backupFolderInput, "backupFolder");
  attachSaver(importTemplatesEl, "importedTemplates", "array");

  popupShortcutEl.onchange = () => {
    if (popupShortcutEl.checked) popProjects[projectId] = true;
    else delete popProjects[projectId];
    chrome.storage.local.set({ [STORAGE_KEYS.popProjects]: popProjects });
  };

  // popup customizations save
  if (popProjects[projectId]) {
    attachSaver(document.getElementById("openPdfToggle"), "openPdfViewer", "checked");
    attachSaver(document.getElementById("showPdfButton"), "showPdfButton", "checked");
    attachSaver(document.getElementById("autoAutoSaveToggle"), "autoAutoSave", "checked");
  }
}

/**
 * Save the project back to chrome.storage
 */
function saveProject(allProjects, projectId, updatedProject, cb) {
  allProjects[projectId] = updatedProject;
  chrome.storage.local.set({ [STORAGE_KEYS.projects]: allProjects }, cb);
}

/**
 * Render template usages for this project
 */
function renderTemplateUsages(container, project, templates) {
  container.innerHTML = "";
  const usages = project.templateUsages || {};
  Object.entries(usages).forEach(([tId, usage]) => {
    const t = templates[tId];
    const div = document.createElement("div");
    div.className = "template-usage";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = t?.name || tId;

    const actions = document.createElement("div");

    const openBtn = document.createElement("button");
    openBtn.textContent = "Edit Vars";
    openBtn.onclick = () => openTemplateVariables(tId, usage, t);

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => {
      delete project.templateUsages[tId];
      chrome.storage.local.get(STORAGE_KEYS.projects, (data) => {
        const projects = data[STORAGE_KEYS.projects] || {};
        projects[currentProjectId] = project;
        chrome.storage.local.set({ [STORAGE_KEYS.projects]: projects }, () => {
          renderTemplateUsages(container, project, templates);
        });
      });
    };

    actions.appendChild(openBtn);
    actions.appendChild(removeBtn);
    div.appendChild(meta);
    div.appendChild(actions);
    container.appendChild(div);
  });
}

/**
 * Open template variables in file editor with picker
 */
function openTemplateVariables(templateId, usage, template) {
  const editorContent = document.getElementById("fileEditorContent");
  editorContent.innerHTML = "";

  if (!template?.variables?.length) {
    editorContent.textContent = "This template has no variables.";
    return;
  }

  // Dropdown to select variable
  const picker = document.createElement("select");
  picker.className = "var-picker";
  template.variables.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v.name;
    picker.appendChild(opt);
  });

  // Editor container
  const card = document.createElement("div");
  card.className = "var-card active";

  const h3 = document.createElement("h3");
  h3.textContent = "Variable Editor";

  const input = document.createElement("input");
  input.type = "text";
  input.value = usage.variables[template.variables[0]] || "";

  openVar = { templateId, key: template.variables[0] };

  // Change handler: when variable selected, load its value
  picker.onchange = () => {
    const key = picker.value;
    input.value = usage.variables[key] || "";
    openVar = { templateId, key };
  };

  card.appendChild(h3);
  card.appendChild(picker);
  card.appendChild(input);

  editorContent.appendChild(card);
}
