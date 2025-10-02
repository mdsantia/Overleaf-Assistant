// project.js (relevant parts)

const varsContainerId = "templateVars";
const previewTreeId = "previewTree";
const previewTitleId = "previewTitle";

/**
 * Initialize the project view. Always query DOM nodes after the view HTML is injected,
 * and always fetch templates fresh from storage so switching back-and-forth works.
 */
export async function initProjectView(projectId, readOnly = false) {
  // grab DOM refs now (must be done after project.html injected)
  const titleEl = document.getElementById("projectTitle");
  const autoSaveEl = document.getElementById("projectAutoSave");
  const noteEl = document.getElementById("projectCustomNote");
  const saveBtn = document.getElementById("saveProjectBtn");
  const templateSelect = document.getElementById("projectTemplateSelect");
  const varsContainer = document.getElementById(varsContainerId);
  const previewTree = document.getElementById(previewTreeId);
  const previewTitle = document.getElementById(previewTitleId);

  // fetch projects and templates fresh
  const projectsData = await new Promise((res) => chrome.storage.local.get("configProjects", res));
  const templatesData = await new Promise((res) => chrome.storage.local.get("template", res));
  const projects = projectsData.configProjects || {};
  const templates = templatesData.template || {};
  const project = projects[projectId];

  if (!project) {
    if (titleEl) titleEl.textContent = "Project not found";
    return;
  }

  // populate UI
  if (titleEl) titleEl.textContent = `Project: ${project.name}`;
  if (autoSaveEl) autoSaveEl.checked = !!project.autoSave;
  if (noteEl) noteEl.value = project.customNote || "";

  // Populate template select fresh
  if (templateSelect) {
    templateSelect.innerHTML = "<option value=''>-- None --</option>";
    for (const tId in templates) {
      const opt = document.createElement("option");
      opt.value = tId;
      opt.textContent = templates[tId].name || tId;
      templateSelect.appendChild(opt);
    }
    // set selected (if exists)
    templateSelect.value = project.templateId || "";
  }

  // Render vars and preview for the selected template
  renderTemplateVars(templates[templateSelect.value], project.variables || {}, varsContainer);
  renderTemplatePreview(templates[templateSelect.value], previewTree, previewTitle);

  // react to template change — fetch templates fresh on change to be safe
  if (templateSelect) {
    templateSelect.onchange = async () => {
      const fresh = await new Promise((res) => chrome.storage.local.get("template", res));
      const freshTemplates = fresh.template || {};
      renderTemplateVars(freshTemplates[templateSelect.value], {}, varsContainer);
      renderTemplatePreview(freshTemplates[templateSelect.value], previewTree, previewTitle);
    };
  }

  // save button behavior
  if (readOnly) {
    if (autoSaveEl) autoSaveEl.disabled = true;
    if (noteEl) noteEl.disabled = true;
    if (templateSelect) templateSelect.disabled = true;
    if (saveBtn) saveBtn.style.display = "none";
    return;
  }

  if (saveBtn) {
    saveBtn.onclick = () => {
      chrome.storage.local.get("configProjects", (data) => {
        const projects = data.configProjects || {};
        if (!projects[projectId]) return;

        projects[projectId].autoSave = autoSaveEl.checked;
        projects[projectId].customNote = noteEl.value;
        projects[projectId].templateId = templateSelect.value;
        projects[projectId].variables = collectTemplateVars(varsContainer);

        chrome.storage.local.set({ configProjects: projects }, async () => {
          alert("Project saved!");
          const { renderProjects } = await import("./config.js");
          await renderProjects();
          // re-init view so selected template is guaranteed to reflect stored state
          await initProjectView(projectId);
        });
      });
    };
  }
}

/* helper: renders template variables into provided container */
function renderTemplateVars(template, overrides = {}, varsContainer) {
  if (!varsContainer) varsContainer = document.getElementById(varsContainerId);
  varsContainer.innerHTML = "";
  if (!template || !template.variables) return;

  for (const v of template.variables) {
    const label = document.createElement("label");
    label.textContent = v;
    label.style.display = "block";
    label.style.marginTop = "6px";

    const input = document.createElement("input");
    input.type = "text";
    input.id = `var-${v}`;
    input.value = overrides[v] || "";

    varsContainer.appendChild(label);
    varsContainer.appendChild(input);
  }
}

function collectTemplateVars(varsContainer) {
  if (!varsContainer) varsContainer = document.getElementById(varsContainerId);
  const vars = {};
  varsContainer.querySelectorAll("input").forEach((inp) => {
    const key = inp.id.replace("var-", "");
    vars[key] = inp.value;
  });
  return vars;
}

/* Renders file tree in read-only preview (uses folder-children class to match CSS) */
function renderTemplatePreview(template, previewTreeEl, previewTitleEl) {
  if (!previewTreeEl) previewTreeEl = document.getElementById(previewTreeId);
  if (!previewTitleEl) previewTitleEl = document.getElementById(previewTitleId);

  previewTreeEl.innerHTML = "";

  if (!template) {
    if (previewTitleEl) previewTitleEl.textContent = "Select a template";
    return;
  }

  if (previewTitleEl) previewTitleEl.textContent = `Template: ${template.name}`;
  if (template.files && Array.isArray(template.files)) {
    template.files.forEach((f) => {
      previewTreeEl.appendChild(renderNode(f));
    });
  }
}

function renderNode(node) {
  const el = document.createElement("div");

  if (node.type === "folder") {
    el.classList.add("folder-item");
    const span = document.createElement("span");
    span.textContent = node.name;
    span.style.cursor = "pointer";
    span.onclick = () => {
      // toggle open class for preview UI
      el.classList.toggle("open");
    };

    const childrenEl = document.createElement("div");
    childrenEl.classList.add("folder-children");
    if (node.children && node.children.length) {
      node.children.forEach((child) => childrenEl.appendChild(renderNode(child)));
    }

    el.appendChild(span);
    el.appendChild(childrenEl);
  } else {
    el.classList.add("file-item");
    el.textContent = node.name;
  }

  return el;
}
