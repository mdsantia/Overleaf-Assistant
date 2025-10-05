async function renderValue(str, vars) {
  return str.replace(/\$\\([a-zA-Z0-9_]+)\/\$/g, (_, key) => {
    return vars[key] ?? `$\\${key}/$`;
  });
}
