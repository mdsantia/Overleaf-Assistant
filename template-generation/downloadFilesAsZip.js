// downloadFilesAsZip.js
import JSZip from "jszip";
import { saveAs } from "file-saver";

/**
 * Recursively add files/folders to JSZip instance
 * @param {Array} files - file/folder tree
 * @param {JSZip} zip - JSZip instance
 * @param {string} parentPath - current folder path
 */
function addFilesToZip(files, zip, parentPath = "") {
  files.forEach((node) => {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;

    if (node.type === "folder") {
      const folder = zip.folder(node.name);
      if (node.children && node.children.length > 0) {
        addFilesToZip(node.children, folder, fullPath);
      }
    } else if (node.type === "file") {
      zip.file(node.name, node.content || "");
    }
  });
}

/**
 * Downloads file tree as a ZIP
 * @param {Array} files - file/folder tree
 * @param {string} zipName - output ZIP filename
 */
export default async function downloadFilesAsZip(files, zipName) {
  const zip = new JSZip();
  addFilesToZip(files, zip);
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, zipName);
  console.log(`[Downloader] ZIP "${zipName}" ready for download.`);
}
