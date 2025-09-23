export function initTemplateView(templateId, afterDeleteCallback = null) {
  const titleEl = document.getElementById("templateTitle");
  const nameEl = document.getElementById("templateName");
  const contentEl = document.getElementById("templateContent");
  const saveBtn = document.getElementById("saveTemplateBtn");
  const deleteBtn = document.getElementById("deleteTemplateBtn");

  function loadTemplate() {
    chrome.storage.local.get("template", (data) => {
      const templates = data.template || {};
      const tpl = templates[templateId];

      if (!tpl) {
        titleEl.textContent = "Template not found";
        nameEl.value = "";
        contentEl.value = "";
        return;
      }

      titleEl.textContent = tpl.name || "Template";
      nameEl.value = tpl.name || "";
      contentEl.value = tpl.content || "";
    });
  }

  loadTemplate();

  // Save handler (single binding)
  saveBtn.onclick = () => {
    chrome.storage.local.get("template", (data) => {
      const templates = data.template || {};
      if (!templates[templateId]) return;

      templates[templateId].name = nameEl.value;
      templates[templateId].content = contentEl.value;

      chrome.storage.local.set({ template: templates }, () => {
        alert("Template saved!");
        // Update sidebar labels by re-rendering
        // parent config.js will re-render via storage change or you can trigger a render event
      });
    });
  };

  // Delete handler (confirm first)
  deleteBtn.onclick = () => {
    if (!confirm("Delete this template? This cannot be undone.")) return;

    chrome.storage.local.get("template", (data) => {
      const templates = data.template || {};
      if (!templates[templateId]) return;

      delete templates[templateId];
      chrome.storage.local.set({ template: templates }, () => {
        // return to default main view
        const main = document.getElementById("main-view");
        main.innerHTML = `<div class="config-section"><h2>Template deleted</h2><p class="muted">Template was removed.</p></div>`;

        // call optional callback to refresh sidebar
        if (typeof afterDeleteCallback === "function") afterDeleteCallback();
      });
    });
  };
}
