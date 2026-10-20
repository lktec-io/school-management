import zlib from 'node:zlib';

/**
 * Read an uploaded spreadsheet into a grid of strings (first row = headers).
 * CSV: comma, semicolon or tab separated (Excel uses different separators per locale), quoted fields,
 * UTF-8 with or without a byte-order mark. XLSX: first worksheet of an Excel workbook. No third-party
 * parser — an .xlsx file is a ZIP of XML parts, unpacked here with node:zlib.
 */

const BOM = String.fromCharCode(0xfeff);
const MAX_XML_BYTES = 20 * 1024 * 1024; // guards against zip bombs: a 2 MB upload may not inflate past this

export class SpreadsheetError extends Error {}

export function parseCsv(text) {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const firstLine = source.slice(0, Math.max(0, source.search(/\r?\n|$/)));
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

function trimGrid(rows) {
  const grid = rows.map((cells) => Array.from(cells, (cell) => String(cell ?? '').trim()));
  while (grid.length && grid.at(-1).every((cell) => cell === '')) grid.pop();
  return grid;
}

// ---- .xlsx ---------------------------------------------------------------

function unzip(buffer, wanted) {
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('not a zip');
  const entries = buffer.readUInt16LE(eocd + 10);
  let pointer = buffer.readUInt32LE(eocd + 16);
  const files = {};
  let inflated = 0;
  for (let index = 0; index < entries; index += 1) {
    if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error('bad zip');
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength);
    pointer += 46 + nameLength + extraLength + commentLength;
    if (!wanted(name)) continue;

    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    let content;
    if (method === 0) content = data;
    else if (method === 8) content = zlib.inflateRawSync(data, { maxOutputLength: MAX_XML_BYTES - inflated });
    else throw new Error('unsupported compression');
    inflated += content.length;
    files[name] = content.toString('utf8');
  }
  return files;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
  if (code[0] === '#') return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
  return ENTITIES[code] ?? whole;
});
/** Concatenated text of every <t> element (plain and rich-text runs). */
const textOf = (xml) => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((match) => decodeXml(match[1])).join('');
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

function columnIndex(reference) {
  const letters = String(reference ?? '').match(/^[A-Z]+/i)?.[0].toUpperCase() ?? 'A';
  return [...letters].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0) - 1;
}

export function parseXlsx(buffer) {
  const files = unzip(buffer, (name) => name === 'xl/sharedStrings.xml' || name === 'xl/workbook.xml'
    || name === 'xl/_rels/workbook.xml.rels' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name));

  let sheetPath = Object.keys(files).filter((name) => name.startsWith('xl/worksheets/')).sort()[0];
  const firstSheet = files['xl/workbook.xml']?.match(/<(?:\w+:)?sheet\s[^>]*>/)?.[0];
  const relId = firstSheet && (attr(firstSheet, 'r:id') ?? attr(firstSheet, '[\\w]+:id'));
  if (relId && files['xl/_rels/workbook.xml.rels']) {
    const rel = [...files['xl/_rels/workbook.xml.rels'].matchAll(/<Relationship\s[^>]*>/g)].map((m) => m[0]).find((tag) => attr(tag, 'Id') === relId);
    const target = rel && attr(rel, 'Target');
    if (target) {
      const resolved = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      if (files[resolved]) sheetPath = resolved;
    }
  }
  if (!sheetPath) throw new Error('no worksheet');

  const shared = files['xl/sharedStrings.xml']
    ? [...files['xl/sharedStrings.xml'].matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((match) => textOf(match[1]))
    : [];

  const rows = [];
  for (const [, rowAttrs, rowBody] of files[sheetPath].matchAll(/<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const rowNumber = Number(attr(rowAttrs, 'r')) || rows.length + 1;
    const cells = [];
    for (const [, cellAttrs, cellBody = ''] of rowBody.matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const type = attr(cellAttrs, 't');
      const raw = cellBody.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
      let value = raw === undefined ? '' : decodeXml(raw);
      if (type === 's') value = shared[Number(value)] ?? '';
      else if (type === 'inlineStr') value = textOf(cellBody);
      else if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
      cells[columnIndex(attr(cellAttrs, 'r'))] = value;
    }
    if (rowNumber > 0 && rowNumber <= 100000) rows[rowNumber - 1] = Array.from(cells, (cell) => cell ?? '');
  }
  return trimGrid(Array.from(rows, (row) => row ?? []));
}

/** Uploaded file ({ originalname, mimetype, buffer }) → grid. Throws SpreadsheetError with a user-facing message. */
export function readSpreadsheet(file) {
  const name = String(file.originalname ?? '').toLowerCase();
  const isZip = file.buffer.length > 4 && file.buffer.readUInt32LE(0) === 0x04034b50;
  try {
    if (name.endsWith('.xlsx') || isZip) return parseXlsx(file.buffer);
    if (name.endsWith('.xls')) throw new SpreadsheetError('Old .xls files are not supported. In Excel choose Save As → Excel Workbook (.xlsx) or CSV, then upload again.');
    if (name.endsWith('.csv') || name.endsWith('.txt') || /csv|text\/plain/.test(file.mimetype ?? '')) return parseCsv(file.buffer.toString('utf8'));
    throw new SpreadsheetError('Upload a CSV or Excel (.xlsx) file.');
  } catch (error) {
    if (error instanceof SpreadsheetError) throw error;
    throw new SpreadsheetError('The file could not be read. Save it again as CSV or .xlsx and retry.');
  }
}
