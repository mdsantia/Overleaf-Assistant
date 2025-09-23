export function initTemplateView(templateId) {
  const titleEl = document.getElementById("templateTitle");
  const nameEl = document.getElementById("templateName");
  const contentEl = document.getElementById("templateContent");
  const saveBtn = document.getElementById("saveTemplateBtn");
  const deleteBtn = document.getElementById("deleteTemplateBtn");

  chrome.storage.local.get("template", (data) => {
    const templates = data.template || {};
    const tpl = templates[templateId];

    if (!tpl) {
      titleEl.textContent = "Template not found";
      return;
    }

    titleEl.textContent = `Template: ${tpl.name}`;
    nameEl.value = tpl.name;
    contentEl.value = tpl.content || "";
  });

  saveBtn.onclick = () => {
    chrome.storage.local.get("template", (data) => {
      const templates = data.template || {};
      if (!templates[templateId]) return;
      templates[templateId].name = nameEl.value;
      templates[templateId].content = contentEl.value;
      chrome.storage.local.set({ template: templates }, () => {
        alert("Template saved!");
        import("./config.js").then(({ renderTemplates }) => renderTemplates());
        initTemplateView(templateId);
      });
    });
  };

  deleteBtn.onclick = () => {
    if (!confirm("Delete this template?")) return;
    chrome.storage.local.get("template", (data) => {
      const templates = data.template || {};
      delete templates[templateId];
      chrome.storage.local.set({ template: templates }, () => {
        alert("Template deleted!");
        import("./config.js").then(({ renderTemplates }) => renderTemplates());
        document.querySelector(".main").innerHTML =
          "<div class='config-section'><h2>Select an item</h2></div>";
      });
    });
  };
}
