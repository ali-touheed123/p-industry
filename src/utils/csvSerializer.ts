/**
 * csvSerializer.ts — Standard RFC-4180 CSV Serializer with Spreadsheet Formula-Injection Mitigation
 *
 * Implements:
 * 1. Standards-compliant RFC-4180 field escaping:
 *    - Fields containing comma (,), double quote ("), carriage return (\r), or line feed (\n)
 *      are enclosed in outer double quotes.
 *    - Internal double quotes are escaped by doubling ("").
 * 2. Type-aware spreadsheet formula-injection mitigation:
 *    - Authentic JavaScript numbers (finite typeof value === 'number') are serialized as unquoted literals.
 *    - Strings are NEVER trusted solely because they match a numeric regex.
 *    - Untrusted strings starting with formula triggers (=, +, -, @) are prepended with an ASCII
 *      single quote (') before RFC-4180 escaping.
 *    - Leading whitespace followed by a trigger retains whitespace but is prefixed with ' to neutralize formulas.
 *    - Disguising control characters (\t, \r, \n) immediately preceding a formula trigger have those
 *      leading control characters stripped and the remaining trigger prefixed with '.
 *    - Null and undefined are emitted as blank fields.
 *
 * Note: CSV formula mitigation is spreadsheet-oriented (Excel, Calc, Sheets) and is not a universal
 * guarantee for every downstream automated parser.
 */

export type CsvCellValue = string | number | boolean | Date | null | undefined;

/**
 * Serializes a single cell value to an RFC-4180 compliant CSV field with formula injection mitigation.
 */
export function serializeCsvField(value: CsvCellValue): string {
  // 1. Explicit handling of null and undefined
  if (value === null || value === undefined) {
    return '';
  }

  // 2. Explicit handling of authentic numbers
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      // NaN or Infinity must not become misleading/executable numeric output
      return '';
    }
    return String(value);
  }

  // 3. Boolean and Date
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return value.toISOString();
  }

  // 4. Strings: untrusted string policy applies
  let str = String(value);

  // Check if string begins with disguising control characters (\t, \r, \n) followed by a formula trigger
  // Example: "\t=CMD" or "\r\n+PNT"
  if (/^[\t\r\n]+[=+\-@]/.test(str)) {
    // Strip the leading disguising control characters
    str = str.replace(/^[\t\r\n]+/, '');
  }

  // Check if the string begins with a formula trigger (=, +, -, @), possibly preceded by spaces
  // Example: "=SUM(A1)", "+PNT-990", "-DISCOUNT", "@SUM", "  =1+1", "-450.00"
  if (/^\s*[=+\-@]/.test(str)) {
    // Prepend ASCII single quote to neutralize formula execution in spreadsheet software
    str = "'" + str;
  }

  // RFC-4180 escaping: enclose in double quotes if it contains comma, double quote, CR, or LF
  // Also, if we prepended a single quote (trigger mitigation), wrapping in double quotes ensures
  // clean RFC-4180 field boundary semantics.
  const requiresQuotes = /[",\r\n]/.test(str) || str.startsWith("'");

  if (requiresQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Serializes a 2D array of rows into a complete RFC-4180 CSV string.
 * Uses CRLF (\r\n) line terminators per RFC-4180 Section 2.1.
 */
export function serializeCsv(rows: CsvCellValue[][]): string {
  return rows
    .map((row) => row.map(serializeCsvField).join(','))
    .join('\r\n');
}

/**
 * Triggers a browser download of a CSV file using Blob.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  // UTF-8 BOM (\uFEFF) ensures Excel opens UTF-8 encoded text cleanly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
