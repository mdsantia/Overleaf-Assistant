document.addEventListener('DOMContentLoaded', () => {
  // Retrieve the saved folder data
  chrome.storage.local.get("selectedFolder", (data) => {
    const selectedFolder = data.selectedFolder || null;
    const folderNameElement = document.getElementById("folderName");

    // If a folder is selected, show its name
    if (selectedFolder) {
      folderNameElement.textContent = selectedFolder.split('/').pop(); // Show folder name only
    }
  });

  // Handle "Select Folder" button click
  document.getElementById("selectFolderButton").addEventListener("click", () => {
    if ('showDirectoryPicker' in window) {
      // Use File System Access API to select a parent folder (modern browsers)
      selectFolder();
    } else {
      // Fallback to using webkitdirectory for older browsers
      document.getElementById("folderInput").click();  // Trigger the file input dialog
    }
  });

  // File System Access API: Select Parent Folder and Create "Overleaf Helper" Folder
  async function selectFolder() {
    try {
      // Open a directory picker to select a parent folder
      const parentFolderHandle = await window.showDirectoryPicker();

      // Create a folder named "Overleaf Helper" inside the selected parent directory
      const overleafHelperFolder = await parentFolderHandle.getDirectoryHandle('Overleaf Helper', { create: true });

      // Update the displayed folder name with the full path
      const folderName = `${parentFolderHandle.name}/Overleaf Helper`;
      document.getElementById("folderName").textContent = folderName;

      // Save the selected folder path to chrome storage
      chrome.storage.local.set({ selectedFolder: folderName });

      console.log('Folder "Overleaf Helper" created in:', folderName);

    } catch (err) {
      console.error('Error selecting folder or creating directory:', err);
    }
  }

  // Handle folder selection using webkitdirectory (for fallback)
  document.getElementById("folderInput").addEventListener("change", (event) => {
    const folderPath = event.target.files[0].webkitRelativePath.split('/')[0];  // Get folder name

    // Create "Overleaf Helper" folder in the selected directory
    const folderPathFull = `${folderPath}/Overleaf Helper`;

    // Update the displayed folder name
    document.getElementById("folderName").textContent = folderPathFull;

    // Save the selected folder in the extension data
    chrome.storage.local.set({ selectedFolder: folderPathFull });

    // Clear the file input to prevent file upload behavior
    event.target.value = "";

    console.log('Folder "Overleaf Helper" created in:', folderPath);
  });

  // Retrieve and display project data as in your original code
  chrome.storage.local.get("projectStates", (data) => {
    const projectStates = data.projectStates || {};  
    const projectListContainer = document.getElementById("projectList");
    projectListContainer.innerHTML = "";  
  
    if (Object.keys(projectStates).length === 0) {
      const noProjectsMessage = document.createElement("p");
      noProjectsMessage.textContent = "No projects found.";
      projectListContainer.appendChild(noProjectsMessage);
    } else {
      for (const projectId in projectStates) {
        if (projectStates.hasOwnProperty(projectId)) {
          const projectState = projectStates[projectId];
          const projectName = projectState.name;
  
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
          checkbox.checked = projectState.autoSave || false;
          checkbox.style.marginRight = "8px";
          checkbox.addEventListener("click", (event) => {
            event.stopPropagation();  // Prevent row click from opening the link
            projectStates[projectId].autoSave = checkbox.checked;
            chrome.storage.local.set({ projectStates });
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
            event.stopPropagation();  // Prevent row click from opening the link
            delete projectStates[projectId];
            chrome.storage.local.set({ projectStates }, () => {
              projectItem.remove();
            });
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
            chrome.tabs.create({ url: chrome.runtime.getURL(`config.html?projectId=${projectId}`) });
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
