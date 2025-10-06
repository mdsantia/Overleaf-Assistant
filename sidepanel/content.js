(function () {
  function getProjectIdFromUrl(url) {
    const match = url && url.match(/https:\/\/www\.overleaf\.com\/project\/([\w-]+)/);
    return match ? match[1] : null;
  }

  function createSaveIcon(projectId, isSavingEnabled) {
    // Remove old icon container if exists
    const oldContainer = document.getElementById("overleaf-local-save-icon");
    if (oldContainer) oldContainer.remove();

    // Create the icon container
    const iconContainer = document.createElement("div");
    iconContainer.id = "overleaf-local-save-icon";
    iconContainer.style.position = "relative"; // Important for tooltip positioning
    iconContainer.style.cursor = "pointer";
    iconContainer.style.display = "flex";       // Align contents neatly
    iconContainer.style.alignItems = "center";
    iconContainer.style.justifyContent = "center";
    iconContainer.style.height = "100%";
    iconContainer.style.width = "auto";

    // Create the image element for the icon
    const saveIcon = document.createElement("img");
    saveIcon.src = chrome.runtime.getURL("icons/upload-icon-128.png");
    saveIcon.alt = "Save Locally";
    saveIcon.style.width = "auto";
    saveIcon.style.height = "100%";
    saveIcon.style.backgroundColor = "#000";
    saveIcon.style.transition = "transform 0.3s ease, opacity 0.3s ease";
    saveIcon.style.opacity = isSavingEnabled ? "1" : "0.5";

    // Create the tooltip
    const tooltip = document.createElement("div");
    tooltip.textContent = "Upload Template (⇧+Click = Autosave)";
    tooltip.style.position = "absolute";     // <-- Crucial
    tooltip.style.bottom = "-35px";          // Position below the icon
    tooltip.style.left = "50%";
    tooltip.style.transform = "translateX(-50%)";
    tooltip.style.backgroundColor = "#222";
    tooltip.style.color = "#fff";
    tooltip.style.fontSize = "12px";
    tooltip.style.padding = "6px 12px";
    tooltip.style.borderRadius = "8px";
    tooltip.style.whiteSpace = "nowrap";     // Prevent wrapping
    tooltip.style.pointerEvents = "none";    // Prevent hover flicker
    tooltip.style.visibility = "hidden";
    tooltip.style.opacity = "0";
    tooltip.style.transition = "opacity 0.3s ease";

    // Hover behavior
    iconContainer.addEventListener("mouseenter", () => {
      tooltip.style.visibility = "visible";
      tooltip.style.opacity = "1";
      saveIcon.style.transform = "scale(1.1)";
    });
    iconContainer.addEventListener("mouseleave", () => {
      tooltip.style.visibility = "hidden";
      tooltip.style.opacity = "0";
      saveIcon.style.transform = "scale(1)";
    });


    // Click handler (normal = toggle autosave; shift-click = upload panel)
    saveIcon.addEventListener("click", (e) => {
      if (e.shiftKey) {
        // Shift-click autosaves

        // Normal click toggles autosave
        chrome.storage.local.get(["popProjects", "configProjects"], (data) => {
          const popProjects = data.popProjects || {};
          const configProjects = data.configProjects || {};
          const project = popProjects[projectId] || {};
          const new_autosave = !project.autoSave;

          const projectNameElement = document.querySelector(
            "#ide-root > div.ide-react-main > nav > div.project-name.toolbar-center > span"
          );
          const projectName = projectNameElement
            ? projectNameElement.textContent.trim()
            : "Untitled Project";

          popProjects[projectId] = { name: projectName, autoSave: new_autosave };
          configProjects[projectId] = { ...configProjects[projectId], name: projectName };

          chrome.storage.local.set({ popProjects, configProjects }, () => {
            console.log(
              `Saving ${new_autosave ? "enabled" : "disabled"} for project ${projectId}.`
            );
            createSaveIcon(projectId, new_autosave);
          });
        });
        return;
      }
        
      // Click opens upload panel
      chrome.runtime.sendMessage({
        action: "open-upload-panel",
        projectId: projectId,
      });
    });

    iconContainer.appendChild(saveIcon);
    iconContainer.appendChild(tooltip);
    const toolbarRight = document.querySelector("#ide-root > div.ide-react-main > nav > div.toolbar-right");

    if (toolbarRight) {
      toolbarRight.prepend(iconContainer);
    } else {
      console.warn("[Overleaf Extension] toolbar-right not found. Appending to body as fallback.");
      document.body.appendChild(iconContainer);
    }
  }

  const projectId = getProjectIdFromUrl(window.location.href);

  if (projectId) {
    chrome.storage.local.get("popProjects", (data) => {
      const popProjects = data.popProjects || {};
      const project = popProjects[projectId] || {};
      const isSavingEnabled = project.autoSave || false;

      waitForToolbarAndInsertIcon(projectId, isSavingEnabled);
    });
  } else {
    console.error("Project ID not found.");
  }

  function waitForToolbarAndInsertIcon(projectId, isSavingEnabled) {
    const tryInsert = () => {
      const toolbarRight = document.querySelector("#ide-root > div.ide-react-main > nav > div.toolbar-right");
      if (toolbarRight) {
        createSaveIcon(projectId, isSavingEnabled);
        return true;
      }
      return false;
    };
  
    if (!tryInsert()) {
      const observer = new MutationObserver((_, obs) => {
        if (tryInsert()) {
          obs.disconnect();
        }
      });
  
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  
})();
