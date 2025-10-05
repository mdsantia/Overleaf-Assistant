// ==============================
// Overleaf Helper Extension Background
// ==============================

// When the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("Overleaf Helper extension installed.");
});

// ------------------------------
// Keyboard command handlers
// ------------------------------
chrome.commands.onCommand.addListener((command) => {
  let functionName;
  if (command === "open-files") functionName = toggleFileTree;
  if (command === "toggle-forward" || command === "toggle-backward")
    functionName = toggleView;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab.url && tab.url.includes("overleaf.com")) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: functionName,
        args: [command],
      });
    } else {
      console.log("This is not an Overleaf tab, skipping the command.");
    }
  });
});

// ------------------------------
// Toggle File Tree
// ------------------------------
function toggleFileTree() {
  const closedButton = document.querySelector(
    ".custom-toggler.custom-toggler-west.custom-toggler-closed"
  );
  const openButton = document.querySelector(
    ".custom-toggler.custom-toggler-west.custom-toggler-west.custom-toggler-open"
  );

  if (closedButton) {
    closedButton.click();
    console.log("Clicked to show the file tree.");
  } else if (openButton) {
    openButton.click();
    console.log("Clicked to hide the file tree.");
  } else {
    console.log("File tree buttons not found.");
  }
}

// ------------------------------
// Toggle Layout View
// ------------------------------
function toggleView(command) {
  const layoutDropdownBtn = document.querySelector("#layout-dropdown-btn");
  if (layoutDropdownBtn && layoutDropdownBtn.getAttribute("aria-expanded") === "false") {
    layoutDropdownBtn.click();
  }

  const dropdownMenu = document.querySelector(
    "#ide-root > div.ide-react-main > nav > div.toolbar-right > div.toolbar-item.layout-dropdown.dropdown > ul"
  );
  if (!dropdownMenu) return console.error("Dropdown menu not found.");

  const options = dropdownMenu.querySelectorAll("a.dropdown-item");
  let currentOptionIndex = -1;
  options.forEach((option, index) => {
    if (option.classList.contains("active")) currentOptionIndex = index;
  });
  if (currentOptionIndex === -1) return console.error("No selected layout found.");

  let nextOptionIndex = currentOptionIndex;
  do {
    if (command === "toggle-forward") {
      nextOptionIndex = (nextOptionIndex + 1) % options.length;
    } else if (command === "toggle-backward") {
      nextOptionIndex = (nextOptionIndex - 1 + options.length) % options.length;
    }
  } while (options[nextOptionIndex].textContent.includes("PDF in separate tab"));

  options[nextOptionIndex].click();

  if (options[nextOptionIndex].textContent.includes("PDF only")) {
    const pdfViewer = document.querySelector("#panel-pdf > div.pdf.full-size > div.pdf-viewer");
    if (pdfViewer) {
      pdfViewer.setAttribute("tabindex", "-1");
      pdfViewer.focus();
      console.log("PDF focused.");
    }
  } else {
    const editor = document.querySelector(".cm-content");
    if (editor) editor.focus();
  }
}

// ==============================
// Upload Panel Integration
// ==============================
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "open-upload-panel") {
    const { projectId } = message;

    chrome.storage.local.get(["configProjects", "template"], (data) => {
      const configProjects = data.configProjects || {};
      const savedTemplates = data.template || {};
      const project = configProjects[projectId];

      if (!project) return console.error("No config for project:", projectId);

      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        func: injectUploadPanel,
        args: [projectId, project, savedTemplates],
      });
    });
  }

  if (message.action === "build-and-upload-files") {
    const { projectId, templateId } = message;
    chrome.storage.local.get(["configProjects", "template"], (data) => {
      const project = (data.configProjects || {})[projectId];
      const templateText = (data.template || {})[templateId];
      if (!project || !templateText) {
        console.error("Missing project or template for upload.");
        return;
      }

      const vars = project.variables || {};
      const processed = templateText.replace(/\$'([^']+)'\/\$/g, (_, v) => vars[v] || "");

      console.log("Processed template for upload:", processed);

      // TODO: Add uploadToOverleaf(processed)
    });
  }
});

// ------------------------------
// Inject Upload Panel
// ------------------------------
function injectUploadPanel(projectId, project, savedTemplates) {
  const existing = document.getElementById("overleaf-upload-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "overleaf-upload-panel";
  Object.assign(panel.style, {
    position: "fixed",
    top: "60px",
    right: "10px",
    width: "280px",
    padding: "14px",
    backgroundColor: "#1e1e1e",
    color: "#fff",
    borderRadius: "10px",
    zIndex: "10000",
    boxShadow: "0 0 8px rgba(0,0,0,0.3)",
    fontFamily: "sans-serif",
  });

  const title = document.createElement("div");
  title.textContent = `Upload for: ${project.name}`;
  title.style.marginBottom = "10px";
  title.style.fontWeight = "bold";
  panel.appendChild(title);

  const dropdown = document.createElement("select");
  Object.assign(dropdown.style, {
    width: "100%",
    marginBottom: "10px",
    padding: "6px",
    borderRadius: "6px",
  });

  const defaultOpt = document.createElement("option");
  defaultOpt.textContent = "-- Select Template --";
  defaultOpt.value = "";
  dropdown.appendChild(defaultOpt);

  (project.templates || []).forEach((tid) => {
    const option = document.createElement("option");
    option.value = tid;
    option.textContent = savedTemplates[tid].name;
    dropdown.appendChild(option);
  });

  // const textarea = document.createElement("textarea");
  // Object.assign(textarea.style, {
  //   width: "100%",
  //   height: "100px",
  //   borderRadius: "6px",
  //   padding: "6px",
  //   marginBottom: "10px",
  // });
  // textarea.placeholder = "Template content preview...";
  panel.appendChild(dropdown);
  // panel.appendChild(textarea);

  // dropdown.addEventListener("change", () => {
  //   const tid = dropdown.value;
  //   textarea.value = tid && savedTemplates[tid].files ? savedTemplates[tid].files || tid : "";
  // });

  const uploadBtn = document.createElement("button");
  uploadBtn.textContent = "Build & Upload";
  Object.assign(uploadBtn.style, {
    width: "100%",
    padding: "8px",
    backgroundColor: "#4CAF50",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  });
  uploadBtn.addEventListener("click", () => {
    const tid = dropdown.value;
    if (!tid) return alert("Please select a template first.");
    chrome.runtime.sendMessage({
      action: "build-and-upload-files",
      projectId,
      templateId: tid,
    });
  });

  const closeBtn = document.createElement("div");
  closeBtn.textContent = "×";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "6px",
    right: "10px",
    cursor: "pointer",
    fontSize: "16px",
  });
  closeBtn.addEventListener("click", () => panel.remove());

  panel.appendChild(uploadBtn);
  panel.appendChild(closeBtn);
  document.body.appendChild(panel);
}
