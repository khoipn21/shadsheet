import { useCallback } from "react";
import type { HyperFormula } from "hyperformula";
import type { CellAddress, CellValue, SelectionRange, SpreadsheetTableMeta } from "@/types/spreadsheet-types";
import { letterToColIndex } from "@/utils/cell-address";

interface UseClipboardParams {
  activeCell: CellAddress | null;
  selectionRange: SelectionRange | null;
  visibleColumnIds: string[];
  totalRowCount: number;
  meta: SpreadsheetTableMeta | undefined;
  getCellValue: (rowIndex: number, columnId: string) => CellValue;
  /** Check if a cell is editable before writing. Skips non-editable cells. */
  canEditCell: (rowIndex: number, columnId: string) => boolean;
  /** HyperFormula instance for bulk paste optimization */
  hf: HyperFormula | null;
  incrementRenderTrigger: () => void;
}

/** Parse TSV text into a 2D string array */
function parseTsv(text: string): string[][] {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.split("\t"));
}

/** Serialize a 2D value array to TSV */
function toTsv(grid: CellValue[][]): string {
  return grid.map((row) => row.map((v) => (v == null ? "" : String(v))).join("\t")).join("\n");
}

/**
 * Clipboard operations: Ctrl+C (copy), Ctrl+X (cut), Ctrl+V (paste) in TSV format.
 * Paste routes through HyperFormula with suspendEvaluation for bulk performance.
 */
export function useClipboard({
  activeCell,
  selectionRange,
  visibleColumnIds,
  totalRowCount,
  meta,
  getCellValue,
  canEditCell,
  hf,
  incrementRenderTrigger,
}: UseClipboardParams) {
  const colIndexOf = useCallback(
    (columnId: string) => visibleColumnIds.indexOf(columnId),
    [visibleColumnIds],
  );

  const getBounds = useCallback(() => {
    if (selectionRange) {
      const { start, end } = selectionRange;
      const sc = colIndexOf(start.columnId);
      const ec = colIndexOf(end.columnId);
      return {
        minRow: Math.min(start.rowIndex, end.rowIndex),
        maxRow: Math.max(start.rowIndex, end.rowIndex),
        minCol: Math.min(sc, ec),
        maxCol: Math.max(sc, ec),
      };
    }
    if (activeCell) {
      const c = colIndexOf(activeCell.columnId);
      return { minRow: activeCell.rowIndex, maxRow: activeCell.rowIndex, minCol: c, maxCol: c };
    }
    return null;
  }, [selectionRange, activeCell, colIndexOf]);

  const readSelection = useCallback((): CellValue[][] => {
    const bounds = getBounds();
    if (!bounds) return [];
    const { minRow, maxRow, minCol, maxCol } = bounds;
    const result: CellValue[][] = [];
    for (let r = minRow; r <= maxRow; r++) {
      const row: CellValue[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        row.push(getCellValue(r, visibleColumnIds[c]));
      }
      result.push(row);
    }
    return result;
  }, [getBounds, getCellValue, visibleColumnIds]);

  const handleCopy = useCallback(async () => {
    const data = readSelection();
    if (data.length === 0) return;
    const tsv = toTsv(data);
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = tsv;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }, [readSelection]);

  const handleCut = useCallback(async () => {
    await handleCopy();
    const bounds = getBounds();
    if (!bounds) return;
    const { minRow, maxRow, minCol, maxCol } = bounds;

      if (hf) hf.suspendEvaluation();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const colId = visibleColumnIds[c];
          if (!canEditCell(r, colId)) continue;
          if (meta?.updateData(r, colId, null) === false) continue;
          if (hf) {
            hf.setCellContents({ sheet: 0, row: r, col: letterToColIndex(colId) }, [[null]]);
          }
        }
      }
    if (hf) {
      hf.resumeEvaluation();
      incrementRenderTrigger();
    }
  }, [handleCopy, getBounds, meta, visibleColumnIds, canEditCell, hf, incrementRenderTrigger]);

  const handlePaste = useCallback(async () => {
    if (!activeCell) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const rows = parseTsv(text);
    if (rows.length === 0) return;

    const startRow = activeCell.rowIndex;
    const startCol = colIndexOf(activeCell.columnId);
    if (startCol === -1) return;

    // Use suspendEvaluation for bulk paste performance
    if (hf) hf.suspendEvaluation();
    for (let r = 0; r < rows.length; r++) {
      const targetRow = startRow + r;
      if (targetRow >= totalRowCount) break;
        for (let c = 0; c < rows[r].length; c++) {
          const targetCol = startCol + c;
          if (targetCol >= visibleColumnIds.length) break;
          const colId = visibleColumnIds[targetCol];
          if (!canEditCell(targetRow, colId)) continue;
          const val = rows[r][c];
          if (meta?.updateData(targetRow, colId, val) === false) continue;
          if (hf) {
            hf.setCellContents({ sheet: 0, row: targetRow, col: letterToColIndex(colId) }, [[val]]);
          }
        }
      }
    if (hf) {
      hf.resumeEvaluation();
      incrementRenderTrigger();
    }
  }, [activeCell, meta, colIndexOf, totalRowCount, visibleColumnIds, canEditCell, hf, incrementRenderTrigger]);

  return { handleCopy, handleCut, handlePaste };
}
