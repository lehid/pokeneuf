export type CsvRow = Record<string, string>;

/**
 * Minimal RFC 4180 parser (quoted fields, escaped quotes, CRLF, newlines inside quotes).
 * Every cell stays a string: an empty cell is `''`, interpretation is up to the caller.
 */
export function parseCsv(text: string): CsvRow[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (inQuotes) {
      if (ch !== '"') {
        field += ch;
      } else if (src.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src.charAt(i + 1) === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error('CSV: unterminated quoted field');
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const [header, ...body] = records.filter((r) => !(r.length === 1 && r[0] === ''));
  if (!header) return [];

  return body.map((cells, index) => {
    if (cells.length !== header.length) {
      throw new Error(
        `CSV: data row ${index + 1} has ${cells.length} cells, the header has ${header.length}`,
      );
    }
    const row: CsvRow = {};
    header.forEach((name, col) => {
      row[name] = cells[col] ?? '';
    });
    return row;
  });
}
