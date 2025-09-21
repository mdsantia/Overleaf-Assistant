export function initTemplateView(templateId) {
    const titleEl = document.getElementById("templateTitle");
    const contentEl = document.getElementById("templateContent");
    const saveBtn = document.getElementById("saveTemplateBtn");
  
    chrome.storage.local.get("template", (data) => {
      const templates = data.template || {};
      const tpl = templates[templateId];
  
      if (!tpl) {
        titleEl.textContent = "Template not found";
        return;
      }
  
      titleEl.textContent = `Template: ${tpl.name}`;
      contentEl.value = tpl.content || "";
    });
  
    saveBtn.addEventListener("click", () => {
      chrome.storage.local.get("template", (data) => {
        const templates = data.template || {};
        if (!templates[templateId]) return;
  
        templates[templateId].content = contentEl.value;
  
        chrome.storage.local.set({ template: templates }, () => {
          alert("Template saved!");
        });
      });
    });
  }
  