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
          const projectName = projectState.name || "Unnamed Project"; // Use the project name stored in state or a default name

          // Create the project item element
          const projectItem = document.createElement("div");
          projectItem.classList.add("project-item");

          // Create the project name element
          const projectNameElement = document.createElement("span");
          projectNameElement.textContent = `Project ${projectName}`; // Display project name

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