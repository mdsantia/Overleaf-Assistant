// ==============================
// Overleaf Helper Content Script
// ==============================
let cachedShortcuts = null;

function loadShortcuts(callback) {
  if (cachedShortcuts) {
    callback(cachedShortcuts);
  } else {
    chrome.runtime.sendMessage({ type: "get-shortcuts" }, (response) => {
      cachedShortcuts = response;
      callback(cachedShortcuts);
    });
  }
}

document.addEventListener("keydown", (e) => {
  loadShortcuts((shortcuts) => {
    const matchedCommand = Object.entries(shortcuts).find(([command, shortcut]) => {
      return (
        shortcut.key.toUpperCase() === e.key.toUpperCase() &&
        shortcut.ctrl === e.ctrlKey &&
        shortcut.shift === e.shiftKey &&
        shortcut.alt === e.altKey &&
        shortcut.meta === e.metaKey
        );
      });
      
      if (matchedCommand) {
      e.preventDefault();
      e.stopImmediatePropagation();
      chrome.runtime.sendMessage({
        type: "key-pressed",
        command: matchedCommand[0]
      });
    }
  });
}, true);

(() => {
  function getProjectIdFromUrl(url) {
    let match = url.match(/https:\/\/www\.overleaf\.com\/project\/([\w-]+)\/detacher/);
    if (!match) {
      match = url.match(/https:\/\/www\.overleaf\.com\/project\/([\w-]+)/);
    }
    return match ? match[1] : null;
  }

  function updateContainer(dropdown) {
    dropdown.style.position = "static"; 
    dropdown.style.top = "auto"; 
    dropdown.style.right = "auto";
  
    const clonedDropdown = document.getElementById("CLONE")?.querySelector("div");
    const newDropdown = dropdown.cloneNode(true);
    newDropdown.querySelector("ul")?.remove();
  
    if (clonedDropdown) {
      clonedDropdown.replaceWith(newDropdown);
    } else {
      console.warn("[Overleaf Helper] CLONE not found — skipping replaceWith");
    }
  
    const button = dropdown.querySelector("button");
    const newButton = newDropdown.querySelector("button");
    if (newButton && button) {
      newButton.addEventListener('click', () => {
        button.click();
      });
    }
  
    if (button) {
      button.style.opacity = "0";
      button.style.pointerEvents = "none";
      button.style.position = "absolute";
      button.style.zIndex = "-1";
    }
  
    return button;
  }  

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function displaceReview(container, toolbar) {
    const clonedContainer = container.cloneNode(true);
    clonedContainer.id = "CLONE";
    const gap = document.createElement('div');
    gap.style.width = '16px';
    gap.style.display = 'inline-block';
    gap.style.flexShrink = '0';
    
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexShrink = '0';
    div.width = "auto"
    div.id = 'DISPLACED';
    div.appendChild(gap);
    div.appendChild(clonedContainer);
    toolbar.appendChild(div);

    let dropdown = container.querySelector("div > div");
    if (dropdown) {
      const OGBUTTON = dropdown.querySelector("button")?.cloneNode(true);
      const button = updateContainer(dropdown);

      const observer = new MutationObserver(
        debounce(() => {
          dropdown.querySelector("button").style.cssText = OGBUTTON.style.cssText;
          updateContainer(dropdown);
        }, 300)
      );
  
      observer.observe(button, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
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

    const projectName =
      document.querySelector(
        "#ide-root > div.ide-react-main > nav > div.project-name.toolbar-center > span"
      )?.textContent.trim() || "Untitled Project";
    img.addEventListener("click", (e) => {
      if (e.shiftKey) {
        toggleAutoSave(projectId, projectName);
      } else {
        chrome.runtime.sendMessage({
          action: "toggle-upload-panel",
          projectId,
          projectName
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

  function toggleAutoSave(projectId, projectName) {
    chrome.storage.local.get(["popProjects", "configProjects"], (data) => {
      const popProjects = data.popProjects || {};
      const configProjects = data.configProjects || {};
      const project = configProjects[projectId] || {};
      const newState = project.localBackup ? !project.localBackup : true;

      if (newState) {
        popProjects[projectId] = { };
      } else {
        delete popProjects[projectId];
      }
      configProjects[projectId] = {
        ...project,
        name: projectName,
        localBackup: newState
      };
      chrome.storage.local.set({ popProjects, configProjects }, () => {
        console.log(`[AutoSave] ${newState ? "Enabled" : "Disabled"} for ${projectName}`);
        createSaveIcon(projectId, newState);
      });
    });
  }

  function waitForToolbarAndInsertIcon(projectId, isSavingEnabled) {
    const tryInsert = () => {
      const container = document.querySelector(
        "#panel-source-editor > div > div > div.cm-scroller > div.review-mode-switcher-container"
      );
      const toolbar = document.querySelector(
        "#ol-cm-toolbar-wrapper > div.ol-cm-toolbar.toolbar-editor > div.ol-cm-toolbar-button-group.ol-cm-toolbar-end"
      );
      if (toolbar && container) {
        createSaveIcon(projectId, isSavingEnabled);
        displaceReview(container, toolbar);
        return true;
      }
      return false;
    };
  
    const init = () => {
      if (tryInsert()) return;
  
      const observer = new MutationObserver(() => {
        if (tryInsert()) {
          observer.disconnect();
          console.log(`[Inserted] Save icon for project ${projectId}`);
        }
      });
  
      observer.observe(document.body, { childList: true, subtree: true });
    };
  
    // Ensure document.body is ready
    if (document.body) {
      init();
    } else {
      // Defer until DOM is ready
      window.addEventListener("DOMContentLoaded", init);
    }
  }
  
  const projectId = getProjectIdFromUrl(window.location.href);
  if (projectId) {
    chrome.storage.local.get("configProjects", (data) => {
      const projects = data.configProjects || {};
      const project = projects[projectId];
      const isSavingEnabled = project ? project.localBackup : false;
      waitForToolbarAndInsertIcon(projectId, isSavingEnabled);
    });
  } else {
    console.error("[Overleaf Helper] No project ID detected");
  }
  
})();
