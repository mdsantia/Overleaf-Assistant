/**
 * Parse a ZIP Blob into your template’s internal file tree structure.
 * No external libraries. Fully CSP-safe.
 */
 export default async function unzipTemplate(zipBlob) {
    const buffer = await zipBlob.arrayBuffer();
    const view = new DataView(buffer);
    let offset = 0;
  
    // Find end-of-central-directory record (EOCD)
    let eocdOffset = buffer.byteLength - 22;
    while (eocdOffset > 0 && view.getUint32(eocdOffset, true) !== 0x06054b50) {
      eocdOffset--;
    }
    if (eocdOffset <= 0) throw new Error("ZIP: EOCD not found.");
  
    const centralCount = view.getUint16(eocdOffset + 10, true);
    const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  
    // Read central directory entries
    let ptr = centralDirOffset;
    const files = [];
  
    for (let i = 0; i < centralCount; i++) {
      const sig = view.getUint32(ptr, true);
      if (sig !== 0x02014b50) throw new Error("Bad central directory signature.");
  
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHeaderOffset = view.getUint32(ptr + 42, true);
  
      const nameBytes = new Uint8Array(buffer, ptr + 46, nameLen);
      const filename = new TextDecoder().decode(nameBytes);
  
      ptr += 46 + nameLen + extraLen + commentLen;
  
      // Parse local header
      const lh = localHeaderOffset;
      const sig2 = view.getUint32(lh, true);
      if (sig2 !== 0x04034b50) throw new Error("Bad local header signature.");
  
      const nameLen2 = view.getUint16(lh + 26, true);
      const extraLen2 = view.getUint16(lh + 28, true);
  
      const compression = view.getUint16(lh + 8, true);
      const size = view.getUint32(lh + 22, true);
      const dataStart = lh + 30 + nameLen2 + extraLen2;
  
      let content;
  
      const rawData = new Uint8Array(buffer, dataStart, size);
  
      if (filename.endsWith("/")) {
        // Folder
        files.push({ name: filename, type: "folder", content: null });
        continue;
      }
  
      if (compression === 0) {
        // STORED (no compression)
        content = new TextDecoder().decode(rawData);
      } else if (compression === 8) {
        // DEFLATE
        const ds = new DecompressionStream("deflate-raw");
        const writable = ds.writable.getWriter();
        writable.write(rawData);
        writable.close();
        const decompressed = await new Response(ds.readable).arrayBuffer();
        content = new TextDecoder().decode(new Uint8Array(decompressed));
      } else {
        throw new Error("Unsupported ZIP compression method: " + compression);
      }
  
      files.push({
        name: filename,
        type: "file",
        content
      });
    }
  
    // Convert flat ZIP entries into nested folder tree
    return buildFileTree(files);
  }
  
  /**
   * Convert a flat list of ZIP entries into your nested template.files format.
   */
  function buildFileTree(list) {
    const root = {};
  
    for (const entry of list) {
      const parts = entry.name.split("/").filter(Boolean);
      let node = root;
  
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
  
        if (i === parts.length - 1) {
          // File or folder
          if (entry.type === "folder") {
            if (!node[part]) node[part] = { type: "folder", children: {} };
          } else {
            node[part] = {
              type: "file",
              name: part,
              content: entry.content
            };
          }
        } else {
          // Folder path
          if (!node[part]) {
            node[part] = { type: "folder", children: {} };
          }
          node = node[part].children;
        }
      }
    }
  
    // Convert object structure to array structure
    return convertObjectToArray(root);
  }
  
  /**
   * Convert internal object tree into an array-based structure
   * used by your template system.
   */
  function convertObjectToArray(obj) {
    return Object.entries(obj).map(([name, node]) => {
      if (node.type === "folder") {
        return {
          type: "folder",
          name,
          children: convertObjectToArray(node.children)
        };
      } else {
        return {
          type: "file",
          name,
          content: node.content
        };
      }
    });
  }
  