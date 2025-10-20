// fileTreeBuilder.js

/**
 * Recursively build file/folder tree with variable substitution
 * @param {Object} node - single file or folder node
 * @param {Object} vars - variables to replace, e.g., { hwnum: { value: "5", isFile: false } }
 * @returns {Array} processed file/folder tree
 */
 export default function buildFileTree(node, vars) {
  // Helper to replace $var/$ in strings, using the 'value' from the variable object
  const replaceVars = (str) => {
    if (!str) return "";
    return str.replace(/\$\s*\\?(\w+)\s*\/\$/g, (_, v) => {
      // If the variable exists in the vars and has a 'value' property, use it.
      return vars[v]?.value ?? "";  // Use empty string if the variable is not found or has no value.
    });
  };

  // If node is an array, process each element recursively
  if (Array.isArray(node)) {
    return node.map((n) => buildFileTree(n, vars)).flat();
  }

  // Process name with variable substitution
  const name = replaceVars(node.name);

  if (node.type === "folder") {
    return {
      ...node,
      name,
      children: node.children ? buildFileTree(node.children, vars) : [], // recursively build folder children
    };
  } else if (node.type === "file") {
    return {
      ...node,
      name,
      content: replaceVars(node.content),  // apply variable substitution to file content as well
    };
  }

  return node;  // Return the node as is if it is not a "file" or "folder"
}
