// ../template-generation/templateRenderer.js

/**
 * Renders text by replacing $'var'/$ or $\var/$ tokens with variable values.
 * Example: "HW$\\hwnum/$" → "HW3"
 *
 * @param {string} text
 * @param {Object} vars
 * @returns {string}
 */
 export default function renderTemplate(text, vars) {
  if (typeof text !== "string") return text;

  return text
    .replace(/\$'([^']+)'\/\$/g, (_, key) => vars[key] || "")
    .replace(/\\?\$\\([a-zA-Z0-9_]+)\/\$/g, (_, key) => vars[key] || "");
}
