import type { HyperFormula } from "hyperformula";
import type { VisibilityState } from "@tanstack/react-table";
import type { MergedCell, SpreadsheetColumnConfig } from "@/types/spreadsheet-types";
import { getMergeLookupResult } from "@/utils/merge-cell-utils";

interface MergeExportState {
  mergedCells: MergedCell[];
  mergedCellLookup: Map<string, number>;
}

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

/** Resolve visible export columns, preserving current UI order when provided. */
function getVisibleColumns(
  columns: SpreadsheetColumnConfig[],
  columnVisibility: VisibilityState,
  orderedVisibleColumnIds?: string[],
): { visibleIds: string[]; visibleIndices: number[] } {
  const indexById = new Map<string, number>();
  columns.forEach((column, index) => {
    indexById.set(String(column.id), index);
  });

  if (orderedVisibleColumnIds && orderedVisibleColumnIds.length > 0) {
    const visibleIds = orderedVisibleColumnIds.filter(
      (columnId) =>
        columnVisibility[columnId] !== false && indexById.has(columnId),
    );
    return {
      visibleIds,
      visibleIndices: visibleIds
        .map((columnId) => indexById.get(columnId))
        .filter((index): index is number => index != null),
    };
  }

  const visibleIds: string[] = [];
  const visibleIndices: number[] = [];
  columns.forEach((column, index) => {
    const columnId = String(column.id);
    if (columnVisibility[columnId] === false) return;
    visibleIds.push(columnId);
    visibleIndices.push(index);
  });
  return { visibleIds, visibleIndices };
}

/** Read all cell values from HyperFormula as a 2D string array */
function readSheetData(
  hf: HyperFormula,
  sheetId: number,
  visibleColIndices: number[],
  mergeState?: MergeExportState,
): string[][] {
  const dims = hf.getSheetDimensions(sheetId);
  const rows: string[][] = [];

  for (let r = 0; r < dims.height; r++) {
    const row: string[] = [];
    for (let visibleCol = 0; visibleCol < visibleColIndices.length; visibleCol++) {
      const c = visibleColIndices[visibleCol];
      const merge = mergeState
        ? getMergeLookupResult(
            mergeState.mergedCells,
            mergeState.mergedCellLookup,
            r,
            visibleCol,
          )
        : null;
      if (merge && !merge.isAnchor) {
        row.push("");
        continue;
      }
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
  mergeState?: MergeExportState,
  orderedVisibleColumnIds?: string[],
) {
  const { visibleIndices } = getVisibleColumns(
    columns,
    columnVisibility,
    orderedVisibleColumnIds,
  );
  const headers = visibleIndices.map((i) => columns[i].header);
  const data = readSheetData(hf, sheetId, visibleIndices, mergeState);

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
  mergeState?: MergeExportState,
  orderedVisibleColumnIds?: string[],
) {
  const XLSX = await import("xlsx");

  const { visibleIndices } = getVisibleColumns(
    columns,
    columnVisibility,
    orderedVisibleColumnIds,
  );
  const headers = visibleIndices.map((i) => columns[i].header);
  const data = readSheetData(hf, sheetId, visibleIndices, mergeState);

  // Build worksheet with headers
  const wsData = [headers, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Apply number formatting for numeric columns
  const dims = hf.getSheetDimensions(sheetId);
  for (let r = 0; r < dims.height; r++) {
    for (let ci = 0; ci < visibleIndices.length; ci++) {
      const merge = mergeState
        ? getMergeLookupResult(
            mergeState.mergedCells,
            mergeState.mergedCellLookup,
            r,
            ci,
          )
        : null;
      if (merge && !merge.isAnchor) continue;

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

  if (mergeState && mergeState.mergedCells.length > 0) {
    const maxVisibleCol = visibleIndices.length - 1;
    const maxDataRow = dims.height - 1;
    const exportMerges = mergeState.mergedCells
      .map((merge) => ({
        startRow: merge.row,
        endRow: merge.row + merge.rowSpan - 1,
        startCol: merge.col,
        endCol: merge.col + merge.colSpan - 1,
      }))
      .filter(
        (merge) =>
          merge.startRow >= 0 &&
          merge.endRow <= maxDataRow &&
          merge.startCol >= 0 &&
          merge.endCol <= maxVisibleCol,
      )
      .map((merge) => ({
        s: { r: merge.startRow + 1, c: merge.startCol },
        e: { r: merge.endRow + 1, c: merge.endCol },
      }));

    if (exportMerges.length > 0) {
      ws["!merges"] = exportMerges;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename.replace(/[/\\?%*:|"<>]/g, "_"));
}
