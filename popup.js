// Wait for the DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Retrieve the saved project states
  chrome.storage.local.get("projectStates", (data) => {
    const projectStates = data.projectStates || {};  // Empty object if none

    const projectListContainer = document.getElementById("projectList");

    // Ensure there are projects to display
    if (Object.keys(projectStates).length === 0) {
      const noProjectsMessage = document.createElement("p");
      noProjectsMessage.textContent = "No projects found.";
      projectListContainer.appendChild(noProjectsMessage);
    } else {
      // Iterate over project states and create checkboxes for each project
      for (const projectId in projectStates) {
        if (projectStates.hasOwnProperty(projectId)) {
          const projectState = projectStates[projectId];
          const projectName = projectState.name; // Use the project name stored in state

          // Create the project item element
          const projectItem = document.createElement("div");
          projectItem.classList.add("project-item");

          // Create the project name element
          const projectNameElement = document.createElement("span");
          projectNameElement.textContent = `${projectName}`; // Display project name

          // Create the checkbox input
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = projectState.state || false; // Use the state value stored in projectStates
          checkbox.addEventListener("change", () => {
            // Update the project state when checkbox is toggled
            projectStates[projectId].state = checkbox.checked;

            // Save the updated projectStates to chrome.storage.local
            chrome.storage.local.set({ projectStates });

            // Always close the old tab and open a new one
            handleProjectTabOpening(projectId);
          });

          // Append the project name and checkbox to the project item
          projectItem.appendChild(projectNameElement);
          projectItem.appendChild(checkbox);

          // Append the project item to the project list container
          projectListContainer.appendChild(projectItem);
        }
      }
    }
  });

  // Handle "Close" button click
  document.getElementById("closeButton").addEventListener("click", () => {
    window.close(); // Close the popup
  });
});

function handleProjectTabOpening(projectId) {
  // Get all tabs currently open in the browser
  chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function(tab) {
          // Check if the tab URL matches the Overleaf project URL pattern
          if (tab.url && isOverleafProjectUrl(tab.url)) {
              // Extract project ID from the tab URL
              const tabProjectId = getProjectIdFromUrl(tab.url);
              
              // If the project ID matches the one we are looking for, reload the tab
              if (tabProjectId === projectId) {
                  chrome.tabs.reload(tab.id);
              }
          }
      });
  });
}

// Function to check if a URL is an Overleaf project URL
function isOverleafProjectUrl(url) {
  return /https:\/\/www\.overleaf\.com\/project\/[\w-]+/.test(url);
}

// Function to extract project ID from an Overleaf project URL
function getProjectIdFromUrl(url) {
  const match = url && url.match(/https:\/\/www\.overleaf\.com\/project\/([\w-]+)/);
  return match ? match[1] : null;
}
