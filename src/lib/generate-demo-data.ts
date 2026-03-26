import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { CellValue, SpreadsheetColumnConfig } from "@/types/spreadsheet-types";

type RowData = Record<string, CellValue>;

const columnHelper = createColumnHelper<RowData>();

/**
 * Generate demo columns (A, B, C, ... up to count).
 * Column IDs use spreadsheet-style naming: A-Z, AA-AZ, BA-BZ, etc.
 */
export function generateDemoColumns(count: number): ColumnDef<RowData, CellValue>[] {
  return Array.from({ length: count }, (_, i) => {
    const id = getColumnLabel(i);
    return columnHelper.accessor((row) => row[id], {
      id,
      header: id,
      size: 120,
    });
  });
}

/** Generate rows of random data */
export function generateDemoData(rowCount: number, colCount: number): RowData[] {
  const colLabels = Array.from({ length: colCount }, (_, i) => getColumnLabel(i));
  return Array.from({ length: rowCount }, (_, rowIdx) => {
    const row: RowData = {};
    for (const col of colLabels) {
      // Mix of strings, numbers, and booleans for varied content
      const mod = rowIdx % 3;
      if (mod === 0) row[col] = `${col}${rowIdx}`;
      else if (mod === 1) row[col] = Math.round(Math.random() * 10000) / 100;
      else row[col] = rowIdx % 2 === 0;
    }
    return row;
  });
}

/** Generate column configs for the demo — all columns editable as text type */
export function generateDemoColumnConfigs(count: number): SpreadsheetColumnConfig[] {
  return Array.from({ length: count }, (_, i) => {
    const id = getColumnLabel(i);
    return {
      id,
      header: id,
      type: "text" as const,
      editable: true,
    };
  });
}

/** Convert column index to spreadsheet label: 0->A, 25->Z, 26->AA, etc. */
function getColumnLabel(index: number): string {
  let label = "";
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}
