const templateSelect = document.getElementById("projectTemplateSelect");
const varsContainer = document.getElementById("templateVars");
const previewTree = document.getElementById("previewTree");
const previewTitle = document.getElementById("previewTitle");

export function initProjectView(projectId, readOnly = false) {
  const titleEl = document.getElementById("projectTitle");
  const autoSaveEl = document.getElementById("projectAutoSave");
  const noteEl = document.getElementById("projectCustomNote");
  const saveBtn = document.getElementById("saveProjectBtn");

  chrome.storage.local.get(["configProjects", "template"], (data) => {
    const projects = data.configProjects || {};
    const templates = data.template || {};
    const project = projects[projectId];

    if (!project) {
      titleEl.textContent = "Project not found";
      return;
    }

    titleEl.textContent = `Project: ${project.name}`;
    autoSaveEl.checked = project.autoSave || false;
    noteEl.value = project.customNote || "";

    // Populate template select
    templateSelect.innerHTML = "<option value=''>-- None --</option>";
    for (const tId in templates) {
      const opt = document.createElement("option");
      opt.value = tId;
      opt.textContent = templates[tId].name;
      if (project.templateId === tId) opt.selected = true;
      templateSelect.appendChild(opt);
    }

    renderTemplateVars(templates[project.templateId], project.variables || {});
    renderTemplatePreview(templates[project.templateId]);

    // react to template change
    templateSelect.onchange = () => {
      renderTemplateVars(templates[templateSelect.value], {});
      renderTemplatePreview(templates[templateSelect.value]);
    };
  });

  if (readOnly) {
    autoSaveEl.disabled = true;
    noteEl.disabled = true;
    templateSelect.disabled = true;
    saveBtn.style.display = "none";
  } else {
    saveBtn.onclick = () => {
      chrome.storage.local.get("configProjects", (data) => {
        const projects = data.configProjects || {};
        if (!projects[projectId]) return;

        projects[projectId].autoSave = autoSaveEl.checked;
        projects[projectId].customNote = noteEl.value;
        projects[projectId].templateId = templateSelect.value;
        projects[projectId].variables = collectTemplateVars();

        chrome.storage.local.set({ configProjects: projects }, () => {
          alert("Project saved!");
          import("./config.js").then(({ renderProjects }) => renderProjects());
          initProjectView(projectId);
        });
      });
    };
  }
}

function renderTemplateVars(template, overrides) {
  varsContainer.innerHTML = "";
  if (!template || !template.variables) return;

  for (const v of template.variables) {
    const label = document.createElement("label");
    label.textContent = v;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `var-${v}`;
    input.value = overrides[v] || "";

    varsContainer.appendChild(label);
    varsContainer.appendChild(input);
  }
}

function collectTemplateVars() {
  const vars = {};
  document.querySelectorAll("#templateVars input").forEach((inp) => {
    const key = inp.id.replace("var-", "");
    vars[key] = inp.value;
  });
  return vars;
}

/* Renders file tree in read-only preview */
function renderTemplatePreview(template) {
  previewTree.innerHTML = "";

  if (!template) {
    previewTitle.textContent = "Select a template";
    return;
  }

  previewTitle.textContent = `Template: ${template.name}`;
  template.files.forEach((f) => {
    previewTree.appendChild(renderNode(f));
  });
}

function renderNode(node) {
  const el = document.createElement("div");

  if (node.type === "folder") {
    el.classList.add("folder-item");
    const span = document.createElement("span");
    span.textContent = node.name;
    span.onclick = () => el.classList.toggle("open");

    const childrenEl = document.createElement("div");
    childrenEl.classList.add("folder-children");
    node.children.forEach((child) => childrenEl.appendChild(renderNode(child)));

    el.appendChild(span);
    el.appendChild(childrenEl);
  } else {
    el.classList.add("file-item");
    el.textContent = node.name;
  }

  return el;
}
