document.addEventListener("DOMContentLoaded", async () => {
    const select = document.getElementById("templateSelector");
    const uploadBtn = document.getElementById("uploadBtn");
  
    const { templates } = await chrome.storage.local.get("templates");
  
    if (!templates || Object.keys(templates).length === 0) {
      select.innerHTML = `<option>No templates found</option>`;
      uploadBtn.disabled = true;
      return;
    }
  
    for (const [id, template] of Object.entries(templates)) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = template.name || `Template ${id}`;
      select.appendChild(opt);
    }
  
    uploadBtn.addEventListener("click", async () => {
      const templateId = select.value;
      await chrome.runtime.sendMessage({
        action: "uploadSelectedTemplate",
        templateId,
      });
      window.close();
    });
  });
  