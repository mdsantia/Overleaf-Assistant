// fileTreeBuilder.js

/**
 * Recursively build file/folder tree with variable substitution
 * @param {Object} node - single file or folder node
 * @param {Object} vars - variables to replace, e.g., { hwnum: "5" }
 * @returns {Array} processed file/folder tree
 */
 export function buildFileTree(node, vars) {
  // Helper to replace $var/$ in strings
  const replaceVars = (str) => {
    if (!str) return "";
    return str.replace(/\$\s*\\?(\w+)\s*\/\$/g, (_, v) => vars[v] ?? "");
  };

  // If node is an array, process each element
  if (Array.isArray(node)) {
    return node.map((n) => buildFileTree(n, vars)).flat();
  }

  // Process name with variables
  const name = replaceVars(node.name);

  if (node.type === "folder") {
    return {
      ...node,
      name,
      children: node.children ? buildFileTree(node.children, vars) : [],
    };
  } else if (node.type === "file") {
    return {
      ...node,
      name,
      content: replaceVars(node.content),
    };
  }

  return node;
}
