/**
 * Pure JavaScript ZIP creator — macOS-compatible.
 * No external libraries. Fully ZIP-spec compliant.
 */

 function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    let c, table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })());

  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
  const d = new Date();
  const time =
    (d.getHours() << 11) |
    (d.getMinutes() << 5) |
    (d.getSeconds() / 2);
  const date =
    ((d.getFullYear() - 1980) << 9) |
    ((d.getMonth() + 1) << 5) |
    d.getDate();
  return { time, date };
}

function flattenFiles(files, parent = "") {
  const out = [];

  for (const node of files) {
    const path = parent ? `${parent}/${node.name}` : node.name;

    if (node.type === "folder") {
      out.push({ name: path + "/", content: new Uint8Array(0) });
      if (node.children)
        out.push(...flattenFiles(node.children, path));
    } else {
      const enc = new TextEncoder();
      out.push({ name: path, content: enc.encode(node.content || "") });
    }
  }

  return out;
}

export function createZipBlob(flatFiles) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];

  let offset = 0;
  const { time, date } = dosDateTime();

  for (const file of flatFiles) {
    const nameBytes = encoder.encode(file.name);
    const data = file.content;
    const crc = crc32(data);
    const size = data.length;

    // ---- LOCAL HEADER ----
    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);

    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true);        // stored (no compression)
    dv.setUint16(10, time, true);
    dv.setUint16(12, date, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);

    local.set(nameBytes, 30);

    chunks.push(local, data);

    // ---- CENTRAL DIRECTORY ----
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);

    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);

    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + size;
  }

  const centralSize = central.reduce((a, b) => a + b.length, 0);

  // ---- EOCD ----
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);

  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, flatFiles.length, true);
  ev.setUint16(10, flatFiles.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...chunks, ...central, eocd], {
    type: "application/zip",
  });
}

export default async function downloadFilesAsZip(files, zipName) {
  const flat = flattenFiles(files);
  const blob = createZipBlob(flat);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName.endsWith(".zip") ? zipName : zipName + ".zip";
  a.click();
  URL.revokeObjectURL(url);
}
