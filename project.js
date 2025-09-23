export function initProjectView(projectId, readOnly = false) {
  const titleEl = document.getElementById("projectTitle");
  const autoSaveEl = document.getElementById("projectAutoSave");
  const noteEl = document.getElementById("projectCustomNote");
  const saveBtn = document.getElementById("saveProjectBtn");
  const templateSelect = document.getElementById("projectTemplateSelect");
  const varsContainer = document.getElementById("templateVars");

  chrome.storage.local.get(["configProjects", "template"], (data) => {
    const projects = data.configProjects || {};
    const templates = data.template || {};
    const project = projects[projectId] || {};

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

    renderTemplateVars(varsContainer, templates[project.templateId], project.variables || {});
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

function renderTemplateVars(container, template, overrides) {
  container.innerHTML = "";
  if (!template || !template.variables) return;

  for (const v of template.variables) {
    const label = document.createElement("label");
    label.textContent = v;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `var-${v}`;
    input.value = overrides[v] || "";

    container.appendChild(label);
    container.appendChild(input);
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
