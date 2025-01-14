chrome.runtime.onInstalled.addListener(() => {
    console.log("Overleaf Helper extension installed.");
  });

chrome.commands.onCommand.addListener((command) => {
    // Listen if it's the save command Command + Shift + S
    if (command === "toggle-saving") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];

            // Ensure the tab has a URL before proceeding
            if (tab && tab.url) {
                const projectId = getProjectIdFromUrl(tab.url);

                if (projectId) {
                    chrome.storage.local.get(["projectStates"], (data) => {
                        const projectStates = data.projectStates || {};
                        const isSavingEnabled = projectStates[projectId] || false;

                        // Toggle saving state
                        projectStates[projectId] = !isSavingEnabled;
                        chrome.storage.local.set({ projectStates }, () => {
                            console.log(`Saving ${projectStates[projectId] ? "enabled" : "disabled"} for project ${projectId}.`);
                            
                            // Enable or disable the extension icon based on the saving state
                            if (projectStates[projectId]) {
                                chrome.action.enable(tab.id);
                                chrome.action.setIcon({ path: "icons/icon-16.png" });  // Set icon manually when saving is enabled
                            } else {
                                chrome.action.disable(tab.id);
                            }
                            chrome.tabs.reload(tab.id);
                        });
                    });
                } else {
                    console.error("Project ID not found in URL.");
                }
            } else {
                console.error("Tab URL is undefined or invalid.");
            }
        });
        return;
    }

    // Handle other commands like toggle file tree or layout options
    let functionName;
    if (command === "open-files") {
      functionName = toggleFileTree;
    }
    if (command === "toggle-forward" || command === "toggle-backward") {
        functionName = toggleView;
    }

    // Query the currently active tab and ensure we're on Overleaf
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab.url && tab.url.includes("overleaf.com")) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: functionName,
          args: [command]
        });
      } else {
        console.log("This is not an Overleaf tab, skipping the command.");
      }
    });
});


// Function to toggle file tree visibility
function toggleFileTree() {
    const closedButton = document.querySelector('.custom-toggler.custom-toggler-west.custom-toggler-closed');
    const openButton = document.querySelector('.custom-toggler.custom-toggler-west.custom-toggler-open');
  
    if (closedButton) {
      // Click the "closed" button to open the file tree
      closedButton.click();
      console.log("Clicked the button to show the file tree.");
    } else if (openButton) {
      // Click the "open" button to hide the file tree
      openButton.click();
      console.log("Clicked the button to hide the file tree.");
    } else {
      console.log("File tree buttons not found.");
    }
  }
  
  // toggleView function that will run in the context of the Overleaf page
  function toggleView(command) {
    // Find the layout dropdown button by ID and click it
    const layoutDropdownBtn = document.querySelector('#layout-dropdown-btn');
    
    if (layoutDropdownBtn) {
        // Click the button
        if (layoutDropdownBtn.getAttribute('aria-expanded') === 'false') {
            layoutDropdownBtn.click();
        }
    }

    // Find the dropdown menu
    const dropdownMenu = document.querySelector('#ide-root > div.ide-react-main > header > div.toolbar-right > div.toolbar-item.layout-dropdown.dropdown > ul');
    
    if (dropdownMenu) {
        // Get all menu items (Options)
        const options = dropdownMenu.querySelectorAll('a.dropdown-item');
        
        // Find the currently selected option based on the 'active' class
        let currentOptionIndex = -1;
        options.forEach((option, index) => {
            if (option.classList.contains('active')) {
                currentOptionIndex = index;
            }
        });

        if (currentOptionIndex !== -1) {
            // Determine the direction (forward or backward)
            let nextOptionIndex = currentOptionIndex;

            // Move forward or backward and ensure we skip the invalid option (PDF in a separate tab, etc.)
            do {
                if (command === "toggle-forward") {
                    nextOptionIndex = (nextOptionIndex + 1) % options.length;
                } else if (command === "toggle-backward") {
                    nextOptionIndex = (nextOptionIndex - 1 + options.length) % options.length;
                }
            } while (options[nextOptionIndex].textContent.includes("PDF in separate tab")); // Skip the PDF option

            // Click the next valid option
            options[nextOptionIndex].click();

            // Focus on the appropriate element based on the selected option
            if (options[nextOptionIndex].textContent.includes("PDF only")) {
                // Focus on the PDF viewer
                // Select the target element
                const pdfViewer = document.querySelector("#panel-pdf > div.pdf.full-size > div.pdf-viewer");

                if (pdfViewer) {
                    // Ensure the element is focusable
                    pdfViewer.setAttribute("tabindex", "-1");

                    // Focus the element
                    pdfViewer.focus();

                    console.log("Element focused successfully.");
                    // IT WILL STILL REQUIRE TAB PRESSES TO MOVE UP AND DOWN WITH ARROW KEYS
                } else {
                    console.error("Element not found.");
                }
            } else {
                // Focus on the editor
                const editor = document.querySelector('.cm-content');
                if (editor) {
                    editor.focus();
                } else {
                    console.error("Editor not found.");
                }
            }
        } else {
            console.error("No selected option found.");
        }
    } else {
        console.error("Dropdown menu not found.");
    }
}



// SAVING BACKGROUND PROCESS

// Helper function to extract project ID from Overleaf URL
function getProjectIdFromUrl(url) {
    // Match the Overleaf project URL and extract the project ID
    const match = url && url.match(/https:\/\/www\.overleaf\.com\/project\/([\w-]+)/);
    return match ? match[1] : null;
  }

// Helper function to focus next
function focusNextElement() {
    // Get all focusable elements on the page
    const focusableSelectors = [
        'a[href]',
        'button',
        'textarea',
        'input',
        'select',
        '[tabindex]:not([tabindex="-1"])'
    ];
    const focusableElements = Array.from(document.querySelectorAll(focusableSelectors.join(',')))
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

    // Find the currently focused element
    const currentIndex = focusableElements.indexOf(document.activeElement);

    // Calculate the next index (looping back to the start if necessary)
    const nextIndex = (currentIndex + 1) % focusableElements.length;

    // Focus the next element
    if (focusableElements[nextIndex]) {
        focusableElements[nextIndex].focus();
        console.log("Moved focus to the next element.");
    } else {
        console.error("No focusable element found.");
    }
}