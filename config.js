document.addEventListener("DOMContentLoaded", () => {
  const projectListEl = document.getElementById("projectList");
  const configSection = document.getElementById("configSection");

  const urlParams = new URLSearchParams(window.location.search);
  const preselectProjectId = urlParams.get("projectId");

  chrome.storage.local.get(["projectStates"], (data) => {
    const projectStates = data.projectStates || {};

    for (const projectId in projectStates) {
      const project = projectStates[projectId];
      const link = document.createElement("div");
      link.className = "project-link";
      link.textContent = project.name;
      link.dataset.projectId = projectId;

      link.addEventListener("click", () => {
        setActiveProject(projectId, projectStates[projectId], link);
      });

      projectListEl.appendChild(link);
    }

    if (preselectProjectId && projectStates[preselectProjectId]) {
      const preselectLink = projectListEl.querySelector(
        `[data-project-id="${preselectProjectId}"]`
      );
      if (preselectLink) {
        preselectLink.click();
      }
    }
  });

  function setActiveProject(projectId, project, linkEl) {
    document.querySelectorAll(".project-link").forEach((el) =>
      el.classList.remove("active")
    );
    linkEl.classList.add("active");

    configSection.innerHTML = `
      <h2>Config: ${project.name}</h2>
      <label>
        <input type="checkbox" id="autoSave" ${
          project.autoSave ? "checked" : ""
        }>
        Enable Auto-Save
      </label>

      <label for="customNote">Custom Note:</label>
      <input type="text" id="customNote" value="${
        project.customNote || ""
      }">

      <button class="save-button">Save</button>
    `;

    configSection
      .querySelector(".save-button")
      .addEventListener("click", () => {
        const autoSave = document.getElementById("autoSave").checked;
        const customNote = document.getElementById("customNote").value;

        chrome.storage.local.get(["projectStates"], (data) => {
          const projectStates = data.projectStates || {};
          if (!projectStates[projectId]) return;

          projectStates[projectId].autoSave = autoSave;
          projectStates[projectId].customNote = customNote;

          chrome.storage.local.set({ projectStates }, () => {
            alert("Settings saved!");
          });
        });
      });
  }
});
