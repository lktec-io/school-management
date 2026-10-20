/**
 * Read an uploaded spreadsheet into a grid of strings (first row = headers), entirely in the browser.
 * Supports CSV (comma, semicolon or tab separated, as Excel saves it in different locales) and
 * Excel .xlsx workbooks (first sheet). No third-party parser: .xlsx is a ZIP of XML files, unpacked
 * with the browser's DecompressionStream and read with DOMParser.
 */

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const BOM = String.fromCharCode(0xfeff); // Excel adds a byte-order mark to UTF-8 CSV files

/** RFC 4180 CSV with quoted fields, escaped quotes ("") and CRLF/LF line endings. */
export function parseCsv(text) {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const firstLine = source.slice(0, source.search(/\r?\n|$/));
  const delimiter = [',', ';', '\t'].reduce((best, candidate) => (
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best
  ), ',');

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return trimGrid(rows);
}

/** Drop trailing empty rows and empty trailing cells. */
function trimGrid(rows) {
  const grid = rows.map((cells) => cells.map((cell) => String(cell ?? '').trim()));
  while (grid.length && grid.at(-1).every((cell) => cell === '')) grid.pop();
  return grid;
}

// ---- .xlsx ---------------------------------------------------------------

/** Minimal ZIP reader: { 'xl/worksheets/sheet1.xml': Uint8Array, … } for the entries we ask for. */
async function unzip(buffer, wanted) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // End of central directory record: search backwards for its signature.
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('not-zip');
  const entries = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const files = {};
  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error('bad-zip');
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
    pointer += 46 + nameLength + extraLength + commentLength;
    if (!wanted(name)) continue;

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) files[name] = data;
    else if (method === 8) files[name] = await inflateRaw(data);
    else throw new Error('unsupported-zip');
  }
  return files;
}

async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') throw new Error('no-decompression');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const xml = (bytes) => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
const byTag = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));

/** "C12" → column index 2 (zero-based). */
function columnIndex(reference) {
  const letters = String(reference).match(/^[A-Z]+/i)?.[0].toUpperCase() ?? 'A';
  return [...letters].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0) - 1;
}

/** First worksheet of an .xlsx workbook as a grid of strings (dates stay Excel serial numbers). */
export async function parseXlsx(buffer) {
  const files = await unzip(buffer, (name) => name === 'xl/sharedStrings.xml' || name === 'xl/workbook.xml'
    || name === 'xl/_rels/workbook.xml.rels' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name));

  // Resolve the first sheet listed in the workbook (falls back to the lowest-numbered sheet file).
  let sheetPath = Object.keys(files).filter((name) => name.startsWith('xl/worksheets/')).sort()[0];
  if (files['xl/workbook.xml'] && files['xl/_rels/workbook.xml.rels']) {
    const first = byTag(xml(files['xl/workbook.xml']), 'sheet')[0];
    const relId = first?.getAttribute('r:id') ?? first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const target = byTag(xml(files['xl/_rels/workbook.xml.rels']), 'Relationship').find((rel) => rel.getAttribute('Id') === relId)?.getAttribute('Target');
    if (target) {
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      if (files[path]) sheetPath = path;
    }
  }
  if (!sheetPath) throw new Error('no-sheet');

  const shared = files['xl/sharedStrings.xml']
    ? byTag(xml(files['xl/sharedStrings.xml']), 'si').map((item) => byTag(item, 't').map((node) => node.textContent).join(''))
    : [];

  const rows = [];
  for (const rowNode of byTag(xml(files[sheetPath]), 'row')) {
    const rowNumber = Number(rowNode.getAttribute('r')) || rows.length + 1;
    const cells = [];
    for (const cellNode of byTag(rowNode, 'c')) {
      const type = cellNode.getAttribute('t');
      const valueNode = byTag(cellNode, 'v')[0];
      let value = valueNode?.textContent ?? '';
      if (type === 's') value = shared[Number(value)] ?? '';
      else if (type === 'inlineStr') value = byTag(cellNode, 't').map((node) => node.textContent).join('');
      else if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
      cells[columnIndex(cellNode.getAttribute('r'))] = value;
    }
    rows[rowNumber - 1] = Array.from(cells, (cell) => cell ?? '');
  }
  return trimGrid(Array.from(rows, (row) => row ?? []));
}

/**
 * File → grid. Throws an Error whose `code` is one of: too-large, unsupported, empty, unreadable.
 */
export async function readSpreadsheet(file) {
  const fail = (code) => Object.assign(new Error(code), { code });
  if (file.size > MAX_FILE_BYTES) throw fail('too-large');
  const name = file.name.toLowerCase();
  let grid;
  try {
    if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') grid = parseCsv(await file.text());
    else if (name.endsWith('.xlsx')) grid = await parseXlsx(await file.arrayBuffer());
    else throw fail('unsupported');
  } catch (error) {
    if (error.code) throw error;
    throw fail('unreadable');
  }
  if (grid.length < 2) throw fail('empty');
  return grid;
}
