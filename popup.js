document.addEventListener('DOMContentLoaded', () => {
  // Retrieve and display project data as in your original code
  chrome.storage.local.get(["popProjects", "configProjects"], (data) => {
    const popProjects = data.popProjects || {};  
    const projects = data.configProjects || {};  
    const projectListContainer = document.getElementById("pop-projectList");
    const templateButton = document.getElementById("settings-button");
    templateButton.innerHTML = "⚙️";
    templateButton.title = "Configure Assistant";
    templateButton.addEventListener("click", (event) => {
      event.stopPropagation();
      chrome.tabs.create({ url: chrome.runtime.getURL(`config/config.html`) });
    });
    projectListContainer.innerHTML = "";  // empty the list
  
    if (Object.keys(popProjects).length === 0) {
      const noProjectsMessage = document.createElement("p");
      noProjectsMessage.textContent = "No shortcut projects.";
      projectListContainer.appendChild(noProjectsMessage);
    } else {
      for (const projectId of Object.keys(popProjects)) {
        const project = projects[projectId];
        if (!project) return;
        const projectName = project.name;

        // Create the project item element
        const projectItem = document.createElement("div");
        projectItem.classList.add("project-item");
        projectItem.style.display = "flex";
        projectItem.style.alignItems = "center";
        projectItem.style.justifyContent = "space-between";
        projectItem.style.cursor = "pointer";
        projectItem.style.padding = "8px";
        projectItem.addEventListener("click", () => {
          window.open(`https://www.overleaf.com/project/${projectId}`, "_blank");
        });

        // Create checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = project.localBackup || false;
        checkbox.style.marginRight = "8px";
        checkbox.addEventListener("click", (event) => {
          event.stopPropagation();  // Prevent row click from opening the link
          projects[projectId].localBackup = checkbox.checked;
          chrome.storage.local.set({ configProjects: projects });
        });

        // Create project name container (clickable)
        const projectNameContainer = document.createElement("span");
        projectNameContainer.textContent = projectName;
        projectNameContainer.style.flexGrow = "1";

        // Create delete button (hidden by default, shown on hover)
        const deleteButton = document.createElement("button");
        deleteButton.innerHTML = "&#128465;";  // Unicode for trash bin icon 🗑
        deleteButton.classList.add("trash-button");
        deleteButton.addEventListener("click", (event) => {
          event.stopPropagation(); // Prevent parent click
          projects[projectId].popupShortcut = false;
        
          chrome.storage.local.set(
            { configProjects: projects, popProjects },
            () => {
              projectItem.remove(); // Remove DOM node after saving
            }
          );
        });        

        // Create PDF button
        const pdfButton = document.createElement("button");
        pdfButton.innerHTML = "📄";  // or use an SVG/icon if you prefer
        pdfButton.classList.add("pdf-button");
        pdfButton.title = "Open PDF Viewer";
        pdfButton.addEventListener("click", (event) => {
          event.stopPropagation();  // Don’t trigger the main project open
          const pdfUrl = `https://www.overleaf.com/project/${projectId}/output/output.pdf`;
          chrome.tabs.create({ url: pdfUrl });
        });
        
        // ⚙️ Config button
        const configButton = document.createElement("button");
        configButton.innerHTML = "⚙️";
        configButton.classList.add("config-button");
        configButton.title = "Configure Project";
        configButton.addEventListener("click", (event) => {
          event.stopPropagation();
          chrome.tabs.create({ url: chrome.runtime.getURL(`config/config.html?projectId=${projectId}`) });
        });
        
        // Append everything
        projectItem.appendChild(checkbox);
        projectItem.appendChild(projectNameContainer);
        projectItem.appendChild(deleteButton);
        projectItem.appendChild(pdfButton);
        projectItem.appendChild(configButton);
        projectListContainer.appendChild(projectItem);
      }
    }
  });

  // Handle "Close" button click
  document.getElementById("closeButton").addEventListener("click", () => {
    window.close(); // Close the popup
  });

  document.getElementById("openOverleafLink").addEventListener("click", function () {
    chrome.tabs.create({ url: "https://www.overleaf.com/project" });
  });  
});

function handleProjectTabOpening(projectId) {
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function(tab) {
      if (tab.url && isOverleafProjectUrl(tab.url)) {
        const tabProjectId = getProjectIdFromUrl(tab.url);
        if (tabProjectId === projectId) {
          chrome.tabs.reload(tab.id);
        }
      }
    });
  });
}

function isOverleafProjectUrl(url) {
  return /https:\/\/www\.overleaf\.com\/project\/[\w-]+/.test(url);
}

function getProjectIdFromUrl(url) {
  const match = url && url.match(/https:\/\/www\.overleaf\.com\/project\/([\w-]+)/);
  return match ? match[1] : null;
}
