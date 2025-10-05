import { renderValue } from "./templateRenderer.js";

async function buildNode(node, vars, path = "") {
    if (node.type === "folder") {
      const folderName = await renderValue(node.name, vars);
      const folderPath = `${path}${folderName}/`;
  
      const files = [];
      for (const child of node.children || []) {
        const childFiles = await buildNode(child, vars, folderPath);
        files.push(...childFiles);
      }
      return files;
    }
  
    if (node.type === "file") {
      const name = await renderValue(node.name, vars);
      const content = await renderValue(node.content || "", vars);
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], path + name);
      return [file];
    }
  
    return [];
  }
  
  async function buildFileTree(template, vars) {
    const allFiles = [];
    for (const fileDef of template.files || []) {
      const files = await buildNode(fileDef, vars);
      allFiles.push(...files);
    }
    return allFiles;
  }
  