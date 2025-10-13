// ==============================
// Overleaf Helper Content Script
// ==============================
(() => {
  function getProjectIdFromUrl(url) {
    const match = url.match(/https:\/\/www\.overleaf\.com\/project\/([\w-]+)/);
    return match ? match[1] : null;
  }

  function createSaveIcon(projectId, isSavingEnabled) {
    const old = document.getElementById("overleaf-local-save-icon");
    if (old) old.remove();

    const container = document.createElement("div");
    container.id = "overleaf-local-save-icon";
    Object.assign(container.style, {
      position: "relative",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      width: "auto",
    });

    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("icons/upload-icon-128.png");
    img.alt = "Upload Template";
    Object.assign(img.style, {
      height: "100%",
      opacity: isSavingEnabled ? "1" : "0.5",
      transition: "transform 0.3s ease, opacity 0.3s ease",
    });

    // Create the tooltip
    const tooltip = document.createElement("div");
    tooltip.textContent = "Upload Template (⇧+Click = Autosave)";
    Object.assign(tooltip.style, {
      position: "absolute",
      bottom: "-35px",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "#222",
      color: "#fff",
      fontSize: "12px",
      padding: "6px 12px",
      borderRadius: "8px",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      visibility: "hidden",
      opacity: "0",
      transition: "opacity 0.3s ease",
    });

    container.addEventListener("mouseenter", () => {
      tooltip.style.visibility = "visible";
      tooltip.style.opacity = "1";
      img.style.transform = "scale(1.1)";
    });
    container.addEventListener("mouseleave", () => {
      tooltip.style.visibility = "hidden";
      tooltip.style.opacity = "0";
      img.style.transform = "scale(1)";
    });

    img.addEventListener("click", (e) => {
      if (e.shiftKey) {
        toggleAutoSave(projectId);
      } else {
        chrome.runtime.sendMessage({
          action: "toggle-upload-panel",
          projectId,
        });
      }
    });

    container.appendChild(img);
    container.appendChild(tooltip);

    const toolbarRight = document.querySelector(
      "#ide-root > div.ide-react-main > nav > div.toolbar-right"
    );
    if (toolbarRight) toolbarRight.prepend(container);
    else document.body.appendChild(container);
  }

  function toggleAutoSave(projectId) {
    chrome.storage.local.get(["popProjects", "configProjects"], (data) => {
      const popProjects = data.popProjects || {};
      const configProjects = data.configProjects || {};
      const project = popProjects[projectId] || {};
      const newState = !project.autoSave;

      const projectName =
        document.querySelector(
          "#ide-root > div.ide-react-main > nav > div.project-name.toolbar-center > span"
        )?.textContent.trim() || "Untitled Project";

      popProjects[projectId] = { name: projectName, autoSave: newState };
      configProjects[projectId] = {
        ...configProjects[projectId],
        name: projectName,
      };
      chrome.storage.local.set({ popProjects, configProjects }, () => {
        console.log(`[AutoSave] ${newState ? "Enabled" : "Disabled"} for ${projectName}`);
        createSaveIcon(projectId, newState);
      });
    });
  }

  function waitForToolbarAndInsertIcon(projectId, isSavingEnabled) {
    const tryInsert = () => {
      // review document.querySelector("#panel-source-editor > div > div > div.cm-scroller > div.review-mode-switcher-container")
      const toolbar = document.querySelector(
        "#ide-root > div.ide-react-main > nav > div.toolbar-right"
      );
      if (toolbar) {
        createSaveIcon(projectId, isSavingEnabled);
        return true;
      }
      return false;
    };

    if (!tryInsert()) {
      const obs = new MutationObserver(() => {
        if (tryInsert()) obs.disconnect();
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  const projectId = getProjectIdFromUrl(window.location.href);
  if (projectId) {
    chrome.storage.local.get("popProjects", (data) => {
      const isSavingEnabled = data.popProjects?.[projectId]?.autoSave || false;
      waitForToolbarAndInsertIcon(projectId, isSavingEnabled);
    });
  } else {
    console.error("[Overleaf Helper] No project ID detected");
  }
})();
