/**
 * excelExporter.ts — Shared XLSX Exporter wrapping write-excel-file@4.1.1
 *
 * Implements typed XLSX generation:
 * - String for untrusted user/system text columns.
 * - Number only for validated finite numeric values.
 * - Cell objects with explicit value and type.
 * - Browser download via Blob / writeXlsxFile browser API.
 * - Does not construct formulas from user-controlled strings.
 */

import writeXlsxFile from 'write-excel-file/browser';
import type { SheetData, Row, Cell } from 'write-excel-file/browser';

export interface ExportColumnDef<T> {
  header: string;
  width?: number; // width in characters
  type: 'String' | 'Number' | 'Date';
  format?: string;
  getValue: (item: T) => string | number | Date | null | undefined;
}

/**
 * Builds typed SheetData and exports to an Excel (.xlsx) file in the browser.
 */
export async function exportToXlsx<T>(
  filename: string,
  data: T[],
  columns: ExportColumnDef<T>[],
  sheetName = 'Sheet1',
  /** Optional bold footer row, one entry per column (string label, number total, or null). */
  footerValues?: Array<string | number | null>
): Promise<void> {
  // 1. Header row
  const headerRow: Row = columns.map((col) => ({
    value: col.header,
    fontWeight: 'bold',
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    align: col.type === 'Number' ? 'right' : 'left',
  }));

  // 2. Data rows
  const dataRows: Row[] = data.map((item) => {
    return columns.map((col): Cell => {
      const rawVal = col.getValue(item);

      if (rawVal === null || rawVal === undefined) {
        return null;
      }

      if (col.type === 'Number') {
        const num = Number(rawVal);
        if (!Number.isFinite(num)) {
          return null;
        }
        return {
          value: num,
          type: Number,
          format: col.format || '#,##0.00',
          align: 'right',
        };
      }

      if (col.type === 'Date') {
        const d = rawVal instanceof Date ? rawVal : new Date(rawVal as any);
        if (isNaN(d.getTime())) return null;
        return {
          value: d,
          type: Date,
          format: col.format || 'yyyy-mm-dd',
        };
      }

      // Default: String type for text columns (formula injection immune via String cell type)
      return {
        value: String(rawVal),
        type: String,
        align: 'left',
      };
    });
  });

  const footerRows: Row[] = [];
  if (footerValues && footerValues.length > 0) {
    footerRows.push(
      columns.map((col, idx): Cell => {
        const v = footerValues[idx];
        if (v === null || v === undefined) return { value: '', type: String, backgroundColor: '#E2E8F0' };
        if (typeof v === 'number' && Number.isFinite(v)) {
          return {
            value: v,
            type: Number,
            format: col.format || '#,##0.00',
            align: 'right',
            fontWeight: 'bold',
            backgroundColor: '#E2E8F0',
          };
        }
        return { value: String(v), type: String, align: 'left', fontWeight: 'bold', backgroundColor: '#E2E8F0' };
      })
    );
  }

  const sheetData: SheetData = [headerRow, ...dataRows, ...footerRows];

  const columnWidths = columns.map((col) => ({
    width: col.width || 18,
  }));

  const fullFileName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  await writeXlsxFile(sheetData, {
    sheet: sheetName,
    columns: columnWidths,
  }).toFile(fullFileName);
}
