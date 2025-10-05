/*****************************************************
 * background.js - Local download and upload template
 *****************************************************/

 chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "upload-template",
      title: "Upload Template to Overleaf",
      contexts: ["action"], // Right-click extension icon
    });
  });
  
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "upload-template") {
      await chrome.sidePanel.open({ tabId: tab.id });
      await chrome.runtime.sendMessage({ action: "openTemplateSelector" });
    }
  });
  
  // Listen for selection from the side panel
  chrome.runtime.onMessage.addListener(async (msg, sender) => {
    if (msg.action === "uploadSelectedTemplate") {
      const { templateId } = msg;
      await handleUploadTemplate(templateId);
    }
  });
  
  // -------------------------------
  // Upload Logic (same as before)
  // -------------------------------
  async function handleUploadTemplate(templateId) {
    const { templates, configProjects, activeProjectId } = await chrome.storage.local.get([
      "templates",
      "configProjects",
      "activeProjectId",
    ]);
  
    const projectId = activeProjectId || Object.keys(configProjects)[0];
    const project = configProjects[projectId];
    const template = templates[templateId];
  
    if (!project || !template) {
      console.error("Missing project or template");
      return;
    }
  
    // Parse variables
    let vars = {};
    try {
      const parsed =
        typeof project.templates === "string"
          ? JSON.parse(project.templates)
          : project.templates;
      if (parsed?.variables) {
        for (const v of parsed.variables) vars[v.name] = v.value;
      }
    } catch (e) {
      console.error("Variable parsing error:", e);
    }
  
    const files = await buildFileTree(template, vars);
  
    // Find Overleaf tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes("overleaf.com")) {
      console.error("Not an Overleaf tab.");
      return;
    }
  
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: uploadToOverleaf,
      args: [files],
    });
  }
  
  // Helpers
  async function renderValue(str, vars) {
    return str.replace(/\$\\([a-zA-Z0-9_]+)\/\$/g, (_, key) => vars[key] ?? `$\\${key}/$`);
  }
  
  async function buildNode(node, vars, path = "") {
    if (node.type === "folder") {
      const name = await renderValue(node.name, vars);
      const files = [];
      for (const child of node.children || []) {
        const childFiles = await buildNode(child, vars, `${path}${name}/`);
        files.push(...childFiles);
      }
      return files;
    }
    if (node.type === "file") {
      const name = await renderValue(node.name, vars);
      const content = await renderValue(node.content || "", vars);
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], path + name);
      return [file];
    }
    return [];
  }
  
  async function buildFileTree(template, vars) {
    const files = [];
    for (const fileDef of template.files || []) {
      const f = await buildNode(fileDef, vars);
      files.push(...f);
    }
    return files;
  }
  
  function uploadToOverleaf(files) {
    const input = document.querySelector('input[type="file"]');
    if (!input) return console.error("Overleaf upload input not found.");
    const dt = new DataTransfer();
    for (const file of files) dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  