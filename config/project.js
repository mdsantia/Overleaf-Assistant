const STORAGE_KEYS = {
  projects: "configProjects",
  templates: "template",
  popProjects: "popProjects",
  archives: "archive"
};

let currentProjectId = null;
let readOnlyMode = false;
let currentOpenTemplateId = null;

// -------------------- INIT PROJECT VIEW --------------------
export async function initProjectView(projectId, readOnly = false) {
  currentProjectId = projectId;
  readOnlyMode = readOnly;

  const storageKey = readOnly ? STORAGE_KEYS.archives : STORAGE_KEYS.projects;
  const { [storageKey]: projectStore = {} } = await chrome.storage.local.get(storageKey);
  const project = projectStore[projectId];
  if (!project) {
    document.querySelector(".app").textContent = "Project not found.";
    return;
  }

  // --- Project title ---
  const nameEl = document.getElementById("projectName");
  if (nameEl) nameEl.textContent = project.name || "Untitled Project";

  // --- Primary Document Name ---
  const mainDocInput = document.getElementById("mainDoc");
  if (mainDocInput && !readOnly) {
    mainDocInput.value = project.mainDoc || "";
    mainDocInput.addEventListener("input", async () => {
      project.mainDoc = mainDocInput.value;
      projectStore[currentProjectId] = project;
      await chrome.storage.local.set({ [storageKey]: projectStore });
    });
  }

  // --- Hidden toggles ---
  setupToggle(document.getElementById("popupShortcut"), "popupShortcut", project, projectStore, storageKey);
  setupToggle(document.getElementById("localBackupToggle"), "localBackup", project, projectStore, storageKey);
  setupToggle(document.getElementById("openPdfToggle"), "openPdfViewer", project, projectStore, storageKey);
  setupToggle(document.getElementById("showPdfButton"), "showPdfButton", project, projectStore, storageKey);
  setupToggle(document.getElementById("autoAutoSaveToggle"), "autoAutoSave", project, projectStore, storageKey);

  // --- Template usage section ---
  setupTemplateUsageSection(project);

  // --- Delete Project ---
  const deleteBtn = document.getElementById("deleteProjectBtn");
  if (deleteBtn && !readOnly) {
    deleteBtn.onclick = async () => {
      if (!confirm("Delete this project?")) return;
      delete projectStore[projectId];
      await chrome.storage.local.set({ [storageKey]: projectStore });
      window.location.href = "config.html";
    };
  }

  // --- Save all variables button ---
  const saveBtn = document.getElementById("saveVarBtn");
  if (saveBtn && !readOnly) {
    saveBtn.onclick = async () => {
      if (!currentOpenTemplateId) {
        alert("No template is currently open.");
        return;
      }

      const editor = document.getElementById("fileEditorContent");
      if (!editor) return;

      const inputs = editor.querySelectorAll("input.var-editor");
      const { [STORAGE_KEYS.projects]: store = {} } = await chrome.storage.local.get(STORAGE_KEYS.projects);
      const project = store[currentProjectId];
      if (!project.templates[currentOpenTemplateId]) project.templates[currentOpenTemplateId] = { variables: {} };

      inputs.forEach((input ) => {
        const varName = input.previousSibling.textContent;
        project.templates[currentOpenTemplateId].variables[varName] = { name: varName, value: input.value };
      });

      store[currentProjectId] = project;
      await chrome.storage.local.set({ [STORAGE_KEYS.projects]: store });
      alert(`Variables for template "${currentOpenTemplateId}" saved.`);
    };
  }

  // -------------------- BACKUP FOLDER SELECTOR --------------------
  const selectBtn = document.getElementById("selectFolderButton");
  const folderDisplay = document.getElementById("folderName");
  const folderInput = document.getElementById("folderInput");
  if (!selectBtn || !folderDisplay || !folderInput) return;

  // Disable everything if read-only mode
  selectBtn.disabled = readOnlyMode;
  folderInput.disabled = readOnlyMode;

  // Load and show previously saved folder name (per project)
  if (project.BackupFolderPath) {
    folderDisplay.textContent = project.BackupFolderPath;
  } else {
    folderDisplay.textContent = "None";
  }

  // --- Modern browsers: use File System Access API ---
  selectBtn.addEventListener("click", async () => {
    if (readOnlyMode) return;

    if ("showDirectoryPicker" in window) {
      try {
        const parentFolderHandle = await window.showDirectoryPicker();

        // Create the "Overleaf Helper" subfolder
        const helperFolderHandle = await parentFolderHandle.getDirectoryHandle("Overleaf Helper", { create: true });
        const folderName = `${parentFolderHandle.name}/Overleaf Helper`;

        // Display folder name
        folderDisplay.textContent = folderName;

        // Save safely to project store without overwriting others
        project.BackupFolderPath = folderName;
        projectStore[currentProjectId] = project;
        await chrome.storage.local.set({ [storageKey]: projectStore });

        console.log('Created "Overleaf Helper" folder in:', folderName);
      } catch (err) {
        console.error("Folder selection failed:", err);
      }
    } else {
      // Fallback for browsers without File System Access API
      folderInput.click();
    }
  });

  // --- Fallback: webkitdirectory input handler ---
  folderInput.addEventListener("change", async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const relativePath = files[0].webkitRelativePath;
    const baseFolder = relativePath ? relativePath.split("/")[0] : files[0].name;
    const folderName = `${baseFolder}`;

    // Update UI
    folderDisplay.textContent = folderName;

    // Save safely to Chrome storage per project
    project.BackupFolderPath = folderName;
    projectStore[currentProjectId] = project;
    await chrome.storage.local.set({ [storageKey]: projectStore });

    // Reset input (so user can reselect later)
    event.target.value = "";

    console.log('Fallback folder "Overleaf Helper" created in:', folderName);
  });
}


// -------------------- TOGGLE HELPER --------------------
function setupToggle(el, key, project, store, storageKey) {
  if (!el) return;
  el.checked = !!project[key];
  el.disabled = readOnlyMode;
  el.addEventListener("change", async () => {
    project[key] = el.checked;
    store[currentProjectId] = project;
    await chrome.storage.local.set({ [storageKey]: store });
  });
}

// -------------------- TEMPLATE USAGE SECTION --------------------
function setupTemplateUsageSection(project) {
  const addButton = document.getElementById("addTemplateUsageBtn");
  const usageList = document.getElementById("templateUsageList");
  if (!addButton || !usageList || readOnlyMode) return;

  // Render the list
  const renderTemplateUsageList = async () => {
    usageList.innerHTML = "";
    const { [STORAGE_KEYS.projects]: projectStore = {}, [STORAGE_KEYS.templates]: templates = {} } =
      await chrome.storage.local.get([STORAGE_KEYS.projects, STORAGE_KEYS.templates]);

    const project = projectStore[currentProjectId];
    if (!project.templates) project.templates = [];

    project.templates.forEach((templateId) => {
      const tmpl = templates[templateId];
      if (!tmpl) return;

      const li = document.createElement("div");
      li.className = "template-usage";

      // Button to open variables
      const openBtn = document.createElement("button");
      openBtn.textContent = tmpl.name || templateId;
      openBtn.style.flex = "1";

      if (templateId === currentOpenTemplateId) {
        openBtn.style.backgroundColor = "rgba(0,153,68,0.2)";
        setTimeout(() => li.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
      }

      openBtn.onclick = () => {
        currentOpenTemplateId = templateId;
        openTemplateVariables(templateId, project);
        renderTemplateUsageList();
      };

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.style.color = "red";
      delBtn.onclick = async () => {
        if (!confirm(`Delete template "${tmpl.name}" from project?`)) return;
        if (!confirm("Are you really sure?")) return;

        const idx = project.templates.indexOf(templateId);
        if (idx > -1) project.templates.splice(idx, 1);

        projectStore[currentProjectId] = project;
        await chrome.storage.local.set({ [STORAGE_KEYS.projects]: projectStore });

        if (currentOpenTemplateId === templateId) {
          currentOpenTemplateId = null;
          document.getElementById("fileEditorContent").innerHTML = "<p>Select a variable to edit.</p>";
        }

        renderTemplateUsageList();
      };

      li.appendChild(openBtn);
      li.appendChild(delBtn);
      usageList.appendChild(li);
    });
  };

  // Create dropdown to replace add button temporarily
  const createDropdown = async () => {
    const { [STORAGE_KEYS.projects]: projectStore = {}, [STORAGE_KEYS.templates]: templates = {} } =
      await chrome.storage.local.get([STORAGE_KEYS.projects, STORAGE_KEYS.templates]);

    const project = projectStore[currentProjectId];
    if (!project.templates) project.templates = [];

    const dropdown = document.createElement("select");
    dropdown.style.flex = "1";

    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "None";
    dropdown.appendChild(noneOption);

    Object.entries(templates)
      .filter(([tid]) => !project.templates.includes(tid))
      .forEach(([tid, tmpl]) => {
        const opt = document.createElement("option");
        opt.value = tid;
        opt.textContent = tmpl.name || tid;
        dropdown.appendChild(opt);
      });

    dropdown.onchange = async () => {
      const selectedTemplateId = dropdown.value;
      if (!selectedTemplateId) {
        dropdown.replaceWith(addButton);
        return;
      }

      project.templates.push(selectedTemplateId);
      projectStore[currentProjectId] = project;
      await chrome.storage.local.set({ [STORAGE_KEYS.projects]: projectStore });

      currentOpenTemplateId = selectedTemplateId;
      openTemplateVariables(selectedTemplateId, project);

      dropdown.replaceWith(addButton);
      renderTemplateUsageList();
    };

    return dropdown;
  };

  addButton.onclick = async () => {
    const dropdown = await createDropdown();
    addButton.replaceWith(dropdown);
    dropdown.focus();
  };

  renderTemplateUsageList();
}

// -------------------- OPEN TEMPLATE VARIABLES --------------------
async function openTemplateVariables(templateId, project) {
  const { [STORAGE_KEYS.templates]: templates = {} } = await chrome.storage.local.get(STORAGE_KEYS.templates);
  const template = templates[templateId];
  const editor = document.getElementById("fileEditorContent");
  if (!editor || !template) return;

  editor.innerHTML = "";

  // Header
  const header = document.createElement("h3");
  header.textContent = `Template: ${template.name || templateId}`;
  header.style.marginBottom = "8px";
  editor.appendChild(header);

  const variables = template.variables || [];
  if (!variables.length) {
    const msg = document.createElement("p");
    msg.textContent = "No variables defined for this template.";
    editor.appendChild(msg);
    return;
  }

  variables.forEach((v) => {
    const varName = v.name;

    const card = document.createElement("div");
    card.className = "var-card";

    const label = document.createElement("label");
    label.textContent = varName;
    label.style.fontWeight = "600";

    const input = document.createElement("input");
    input.type = "text";
    input.value = (project.variables && project.variables[varName]) || "";
    input.disabled = readOnlyMode;
    input.className = "var-editor text";

    input.addEventListener("input", async () => {
      const storageKey = readOnlyMode ? STORAGE_KEYS.archives : STORAGE_KEYS.projects;
      const { [storageKey]: store = {} } = await chrome.storage.local.get(storageKey);
      if (!store[currentProjectId]) return;
      if (!store[currentProjectId].variables) store[currentProjectId].variables = {};
      store[currentProjectId].variables[varName] = input.value;
      await chrome.storage.local.set({ [storageKey]: store });
    });

    card.appendChild(label);
    card.appendChild(input);
    editor.appendChild(card);
  });
}
