import type { HyperFormula } from "hyperformula";
import type { VisibilityState } from "@tanstack/react-table";
import type { SpreadsheetColumnConfig } from "@/types/spreadsheet-types";

/** Characters that trigger CSV injection — prefix with single quote */
const CSV_INJECTION_CHARS = ["=", "+", "-", "@"];

/** Sanitize a cell value for CSV export to prevent formula injection */
function sanitizeCSVValue(value: string): string {
  const trimmed = value.trimStart();
  if (trimmed.length > 0 && CSV_INJECTION_CHARS.includes(trimmed[0])) {
    return `'${value}`;
  }
  return value;
}

/** Get visible column indices based on column configs and visibility state */
function getVisibleColumnIndices(
  columns: SpreadsheetColumnConfig[],
  columnVisibility: VisibilityState,
): number[] {
  return columns
    .map((_, i) => i)
    .filter((i) => {
      const colId = columns[i].id;
      return columnVisibility[colId] !== false;
    });
}

/** Read all cell values from HyperFormula as a 2D string array */
function readSheetData(
  hf: HyperFormula,
  sheetId: number,
  visibleColIndices: number[],
): string[][] {
  const dims = hf.getSheetDimensions(sheetId);
  const rows: string[][] = [];

  for (let r = 0; r < dims.height; r++) {
    const row: string[] = [];
    for (const c of visibleColIndices) {
      const val = hf.getCellValue({ sheet: sheetId, row: r, col: c });
      if (val === null || val === undefined) {
        row.push("");
      } else if (typeof val === "object" && "type" in val) {
        // Formula error — export as empty
        row.push("");
      } else {
        row.push(String(val));
      }
    }
    rows.push(row);
  }
  return rows;
}

/** Trigger a browser file download from a Blob */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[/\\?%*:|"<>]/g, "_"); // sanitize filename
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export grid data to CSV file download.
 * Includes column headers as first row. Sanitizes against CSV injection.
 */
export function exportToCSV(
  hf: HyperFormula,
  sheetId: number,
  columns: SpreadsheetColumnConfig[],
  columnVisibility: VisibilityState,
  filename = "export.csv",
) {
  const visibleIndices = getVisibleColumnIndices(columns, columnVisibility);
  const headers = visibleIndices.map((i) => columns[i].header);
  const data = readSheetData(hf, sheetId, visibleIndices);

  const csvRows = [headers, ...data].map((row) =>
    row
      .map((cell) => {
        const sanitized = sanitizeCSVValue(cell);
        // Wrap in quotes if contains comma, quote, or newline
        if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
          return `"${sanitized.replace(/"/g, '""')}"`;
        }
        return sanitized;
      })
      .join(","),
  );

  const csvContent = csvRows.join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

/**
 * Export grid data to XLSX file download via SheetJS.
 * Lazy-loads xlsx to keep initial bundle small.
 */
export async function exportToXLSX(
  hf: HyperFormula,
  sheetId: number,
  columns: SpreadsheetColumnConfig[],
  columnVisibility: VisibilityState,
  filename = "export.xlsx",
) {
  const XLSX = await import("xlsx");

  const visibleIndices = getVisibleColumnIndices(columns, columnVisibility);
  const headers = visibleIndices.map((i) => columns[i].header);
  const data = readSheetData(hf, sheetId, visibleIndices);

  // Build worksheet with headers
  const wsData = [headers, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Apply number formatting for numeric columns
  const dims = hf.getSheetDimensions(sheetId);
  for (let r = 0; r < dims.height; r++) {
    for (let ci = 0; ci < visibleIndices.length; ci++) {
      const c = visibleIndices[ci];
      const val = hf.getCellValue({ sheet: sheetId, row: r, col: c });
      if (typeof val === "number") {
        const cellRef = XLSX.utils.encode_cell({ r: r + 1, c: ci }); // +1 for header row
        if (ws[cellRef]) {
          ws[cellRef].t = "n";
          ws[cellRef].v = val;
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename.replace(/[/\\?%*:|"<>]/g, "_"));
}
