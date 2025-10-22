const STORAGE_KEYS = {
  projects: "configProjects",
  templates: "template",
  popProjects: "popProjects"
};

let currentProjectId = null;
let readOnlyMode = false;
let currentOpenTemplateId = null;

// -------------------- INIT PROJECT VIEW --------------------
export async function initProjectView(projectId, readOnly = false) {
  currentProjectId = projectId;
  readOnlyMode = readOnly;
  currentOpenTemplateId = null;

  const storageKey = STORAGE_KEYS.projects;
  const { [STORAGE_KEYS.projects]: projectStore = {}, [STORAGE_KEYS.popProjects]: popProjects = {} } =
    await chrome.storage.local.get([STORAGE_KEYS.projects, STORAGE_KEYS.popProjects]);

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
  if (mainDocInput) {
    mainDocInput.disabled = readOnlyMode;
    mainDocInput.value = project.mainDoc || "";
    if (!readOnlyMode) {
      mainDocInput.addEventListener("input", async () => {
        project.mainDoc = mainDocInput.value;
        projectStore[currentProjectId] = project;
        await chrome.storage.local.set({ [storageKey]: projectStore });
      });
    }
  }

  // --- Hidden toggles ---
  setupToggle(document.getElementById("popupShortcut"), "popupShortcut", project, projectStore, storageKey, popProjects);
  setupToggle(document.getElementById("localBackupToggle"), "localBackup", project, projectStore, storageKey, popProjects);
  setupToggle(document.getElementById("openPdfToggle"), "openPdfViewer", project, projectStore, storageKey, popProjects);
  setupToggle(document.getElementById("showPdfButton"), "showPdfButton", project, projectStore, storageKey, popProjects);
  setupToggle(document.getElementById("autoAutoSaveToggle"), "autoAutoSave", project, projectStore, storageKey, popProjects);

  // --- Template usage section ---
  setupTemplateUsageSection(project);

  // --- Delete Project ---
  const deleteBtn = document.getElementById("deleteProjectBtn");
  if (deleteBtn && !readOnlyMode) {
    deleteBtn.onclick = async () => {
      if (!confirm("Delete this project?")) return;
      delete projectStore[projectId];
      await chrome.storage.local.set({ [storageKey]: projectStore });
      window.location.href = "config.html";
    };
  }

  // --- Save all variables button ---
  const saveBtn = document.getElementById("saveVarBtn");
  if (saveBtn && !readOnlyMode) {
    saveBtn.onclick = async () => {
      if (!currentOpenTemplateId) {
        alert("No template is currently open.");
        return;
      }

      const editor = document.getElementById("variableEditorContent");
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
      alert(`Variables for template "${project.templates[currentOpenTemplateId].name}" saved.`);
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
function setupToggle(el, key, project, store, storageKey, popProjects) {
  if (!el) return;

  el.checked = !!project[key];
  el.disabled = readOnlyMode;

  const popupCustomizations = document.getElementById('popupCustomizations');

  if (!popProjects) popProjects = {};

  if (key === "popupShortcut") {
    popupCustomizations.classList.toggle('hidden', !el.checked);
  }

  el.addEventListener("change", async () => {
    const isChecked = el.checked;
    project[key] = isChecked;
    store[currentProjectId] = project;

    if (key === "popupShortcut") {
      popupCustomizations.classList.toggle('hidden', !isChecked);
      
      if (isChecked) {
        popProjects[currentProjectId] = true;
      } else {
        delete popProjects[currentProjectId];
      }

      await chrome.storage.local.set({
        [storageKey]: store,
        popProjects
      });
    } else {
      await chrome.storage.local.set({ [storageKey]: store });
    }
  });
}


// -------------------- TEMPLATE USAGE SECTION --------------------
function setupTemplateUsageSection() {
  const addButton = document.getElementById("addTemplateUsageBtn");
  const usageList = document.getElementById("templateUsageList");
  if (!addButton || !usageList) return;

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
      if (!readOnlyMode) {
        delBtn.onclick = async () => {
          if (!confirm(`Delete template "${tmpl.name}" from project?`)) return;
          if (!confirm("Are you really sure?")) return;
  
          const idx = project.templates.indexOf(templateId);
          if (idx > -1) project.templates.splice(idx, 1);
  
          projectStore[currentProjectId] = project;
          await chrome.storage.local.set({ [STORAGE_KEYS.projects]: projectStore });
  
          renderTemplateUsageList();
        };
      }

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

  if (!readOnlyMode) {
    addButton.onclick = async () => {
      const dropdown = await createDropdown();
      addButton.replaceWith(dropdown);
      dropdown.focus();
    };
  }

  renderTemplateUsageList();
}

// -------------------- OPEN TEMPLATE VARIABLES --------------------
async function openTemplateVariables(templateId, project) {
  const { [STORAGE_KEYS.templates]: templates = {} } = await chrome.storage.local.get(STORAGE_KEYS.templates);
  const template = templates[templateId];
  const editor = document.getElementById("variableEditorContent");
  if (!editor || !template) return;

  editor.innerHTML = "";

  // Header
  const title = document.getElementById("templateName");
  const header = title.querySelector("h1");
  header.textContent = `${template.name || templateId} in ${project.name || project.id}`;
  header.style.marginBottom = "8px";
  title.appendChild(header);

  const variables = template.variables || [];
  if (!variables.length) {
    const msg = document.createElement("p");
    msg.textContent = "No variables defined for this template.";
    editor.appendChild(msg);
    return;
  }

  variables.forEach((v) => {
    const varName = v.name;
    const varData = (project.variables && project.variables[varName]) || { value: "", isFile: false };

    const card = document.createElement("div");
    card.className = "var-card";

    // ✅ Checkbox for file mode
    const fileModeCheckbox = document.createElement("input");
    fileModeCheckbox.type = "checkbox";
    fileModeCheckbox.checked = !!varData.isFile;
    fileModeCheckbox.className = "file-mode-checkbox";
    fileModeCheckbox.disabled = readOnlyMode;

    const label = document.createElement("label");
    label.textContent = varName;
    label.style.fontWeight = "600";

    const headerDiv = document.createElement("div");
    headerDiv.style.display = "flex";
    headerDiv.style.alignItems = "center";
    headerDiv.style.gap = "8px";
    headerDiv.appendChild(fileModeCheckbox);
    headerDiv.appendChild(label);

    // ✅ Text input (only created when isFile is false)
    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.value = !varData.isFile ? varData.value || "" : "";
    textInput.disabled = readOnlyMode;
    textInput.className = "var-editor text";

    textInput.addEventListener("input", async () => {
      const storageKey = STORAGE_KEYS.projects;
      const { [storageKey]: store = {} } = await chrome.storage.local.get(storageKey);
      if (!store[currentProjectId]) return;
      if (!store[currentProjectId].variables) store[currentProjectId].variables = {};
      if (!store[currentProjectId].variables[varName]) store[currentProjectId].variables[varName] = {};
      store[currentProjectId].variables[varName].value = textInput.value;
      await chrome.storage.local.set({ [storageKey]: store });
    });

    // ✅ File editor (only created when isFile is true)
    const fileEditorContainer = document.createElement("div");
    fileEditorContainer.innerHTML = `
      <div class="file-editor">
        <div class="file-editor-header" id="openFileName-${varName}">
          ${varName}
        </div>
        <div id="editorWrapper-${varName}" style="position: relative;" class="editorWrapper">
          <pre id="lineNumbers-${varName}" class="file-line-numbers"></pre>
          <textarea id="editorText-${varName}" class="file-textarea"></textarea>
        </div>
      </div>
    `;
    fileEditorContainer.style.width = "100%";
    fileEditorContainer.style.display = fileModeCheckbox.checked ? "block" : "none";

    const editorTextArea = fileEditorContainer.querySelector(`#editorText-${varName}`);
    editorTextArea.value = varData.value;
    editorTextArea.disabled = readOnlyMode;

    editorTextArea.addEventListener("input", async () => {
      const storageKey = STORAGE_KEYS.projects;
      const { [storageKey]: store = {} } = await chrome.storage.local.get(storageKey);
      if (!store[currentProjectId]) return;
      if (!store[currentProjectId].variables) store[currentProjectId].variables = {};
      if (!store[currentProjectId].variables[varName]) store[currentProjectId].variables[varName] = {};
      store[currentProjectId].variables[varName].value = editorTextArea.value;
      await chrome.storage.local.set({ [storageKey]: store });

      updateLineNumbers(varName);
    });

    // ✅ Toggle between file mode and text input
    fileModeCheckbox.addEventListener("change", async () => {
      const storageKey = STORAGE_KEYS.projects;
      const { [storageKey]: store = {} } = await chrome.storage.local.get(storageKey);
      if (!store[currentProjectId]) return;
      if (!store[currentProjectId].variables) store[currentProjectId].variables = {};
      if (!store[currentProjectId].variables[varName]) store[currentProjectId].variables[varName] = {};
      store[currentProjectId].variables[varName].isFile = fileModeCheckbox.checked;
      await chrome.storage.local.set({ [storageKey]: store });

      if (fileModeCheckbox.checked) {
        textInput.remove();
        card.appendChild(fileEditorContainer);
        fileEditorContainer.style.display = "block";
        updateLineNumbers(varName);
      } else {
        fileEditorContainer.remove();
        card.appendChild(textInput);
      }
    });

    card.appendChild(headerDiv);
    if (varData.isFile) {
      card.appendChild(fileEditorContainer);
      updateLineNumbers(varName);
    } else {
      card.appendChild(textInput);
    }

    editor.appendChild(card);
  });

  const saveBtn = document.getElementById("saveVarBtn");
  saveBtn.style.display = "block";
}

function updateLineNumbers(varName) {
  const textArea = document.getElementById(`editorText-${varName}`);
  const lineNumberEl = document.getElementById(`lineNumbers-${varName}`);
  if (!textArea || !lineNumberEl) return;

  const lines = textArea.value.split("\n").length;
  let numbers = "";
  for (let i = 1; i <= lines; i++) {
    numbers += i + "\n";
  }
  lineNumberEl.textContent = numbers;
}

function openFileEditorForVariable(varName, currentValue) {
  const fileEditor = document.createElement("div");
  fileEditor.className = "file-editor-modal";

  const header = document.createElement("div");
  header.className = "file-editor-header";
  header.textContent = `Editing: ${varName}`;

  const textarea = document.createElement("textarea");
  textarea.className = "file-editor-body";
  textarea.value = currentValue || "";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save File";
  saveBtn.className = "file-save-btn";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "file-close-btn";

  saveBtn.onclick = async () => {
    const storageKey = STORAGE_KEYS.projects;
    const { [storageKey]: store = {} } = await chrome.storage.local.get(storageKey);
    if (!store[currentProjectId]) return;
    if (!store[currentProjectId].variables) store[currentProjectId].variables = {};
    store[currentProjectId].variables[varName] = textarea.value;
    await chrome.storage.local.set({ [storageKey]: store });

    document.body.removeChild(fileEditor);
  };

  closeBtn.onclick = () => {
    document.body.removeChild(fileEditor);
  };

  fileEditor.appendChild(header);
  fileEditor.appendChild(textarea);
  fileEditor.appendChild(saveBtn);
  fileEditor.appendChild(closeBtn);
  document.body.appendChild(fileEditor);
}

async function renderSingleVariable(varName) {
  const editor = document.getElementById("variableEditorContent");
  const cards = [...editor.getElementsByClassName("var-card")];
  const card = cards.find(c => c.querySelector("label")?.textContent === varName);
  if (card) card.remove();

  const { [STORAGE_KEYS.projects]: store = {} } = await chrome.storage.local.get(STORAGE_KEYS.projects);
  const project = store[currentProjectId];
  const template = project.templates[currentOpenTemplateId];

  const templateVars = template ? (template.variables || []) : [];
  const varDef = templateVars.find(v => v.name === varName);
  if (!varDef) return;

  // ✅ Reuse logic in openTemplateVariables for just this variable
  const fakeTemplate = { variables: [varDef] };
  const tempProject = store[currentProjectId];
  const tempEditor = document.getElementById("variableEditorContent");
  const prevScroll = tempEditor.scrollTop;
  openTemplateVariables(currentOpenTemplateId, tempProject);
  tempEditor.scrollTop = prevScroll;
}

