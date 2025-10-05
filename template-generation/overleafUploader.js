async function handleUploadTemplate() {
    const { templates, configProjects, activeProjectId } = await chrome.storage.local.get([
      "templates",
      "configProjects",
      "activeProjectId"
    ]);
  
    if (!templates || !configProjects) {
      console.error("Templates or configProjects not found in storage.");
      return;
    }
  
    // Determine which project’s variables to use
    const projectId = activeProjectId || Object.keys(configProjects)[0];
    const project = configProjects[projectId];
    if (!project) {
      console.error("No active or valid project found.");
      return;
    }
  
    // Parse the variables from project.templates (stored as JSON string)
    let variables = {};
    try {
      // Support templates being stored as either a JSON string or an object
      const parsed = typeof project.templates === "string"
        ? JSON.parse(project.templates)
        : project.templates;
  
      if (parsed && parsed.variables) {
        for (const v of parsed.variables) {
          variables[v.name] = v.value;
        }
      }
    } catch (e) {
      console.error("Error parsing project variables:", e);
    }
  
    console.log("Using project variables:", variables);
  
    // Choose the template (first for now)
    const firstKey = Object.keys(templates)[0];
    const template = templates[firstKey];
    if (!template) {
      console.error("No valid template selected.");
      return;
    }
  
    console.log("Building files for template:", template.name);
    const files = await buildFileTree(template, variables);
  
    // Inject upload into Overleaf
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes("overleaf.com")) {
      console.error("Not on Overleaf tab.");
      return;
    }
  
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: uploadToOverleaf,
      args: [files]
    });
  
    console.log(`Template "${template.name}" uploaded successfully to Overleaf.`);
  }
  