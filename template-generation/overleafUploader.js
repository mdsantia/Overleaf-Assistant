// ../template-generation/overleafUploader.js

/**
 * Runs inside the Overleaf page context.
 * Builds folders and uploads file contents using Overleaf’s DOM.
 */
 export async function uploadToOverleaf(files) {
  console.log("[OverleafUploader] Starting upload...");

  // Helper: wait for a selector
  const waitFor = (selector, timeout = 5000) =>
    new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return reject(`Timeout waiting for ${selector}`);
        requestAnimationFrame(check);
      };
      check();
    });

  /**
   * Recursively uploads file/folder tree
   */
  async function uploadNode(node, parentPath = "") {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;

    if (node.type === "folder") {
      console.log(`📁 Creating folder: ${fullPath}`);

      // Simulate “New Folder” in Overleaf
      const newFolderButton = document.querySelector('[aria-label="New Folder"]');
      if (newFolderButton) {
        newFolderButton.click();
        await new Promise(r => setTimeout(r, 400));

        const input = document.querySelector('input[name="newFolderName"]');
        if (input) {
          input.value = node.name;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.blur();
        }
      }

      if (node.children && node.children.length) {
        for (const child of node.children) {
          await uploadNode(child, fullPath);
        }
      }
    } else if (node.type === "file") {
      console.log(`📝 Creating file: ${fullPath}`);
      const newFileButton = document.querySelector('[aria-label="New File"]');
      if (newFileButton) {
        newFileButton.click();
        await new Promise(r => setTimeout(r, 500));

        const input = document.querySelector('input[name="newFileName"]');
        if (input) {
          input.value = node.name;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.blur();
        }

        // Overleaf uses Monaco Editor for content — find and inject
        const editor = document.querySelector(".monaco-editor textarea");
        if (editor) {
          editor.value = node.content || "";
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        }

        // Simulate save
        const saveButton = document.querySelector('[aria-label="Save"]');
        if (saveButton) saveButton.click();
      }
    }
  }

  for (const f of files) {
    await uploadNode(f);
  }

  console.log("[OverleafUploader] Upload complete!");
}
