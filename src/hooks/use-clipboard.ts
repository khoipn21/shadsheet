import { useCallback } from "react";
import type { HyperFormula } from "hyperformula";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
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

async function writeClipboardText(tsv: string) {
  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = tsv;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }
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
  const clipboardSelection = useSpreadsheetStore((s) => s.clipboardSelection);
  const clipboardSelectionMode = useSpreadsheetStore((s) => s.clipboardSelectionMode);
  const setClipboardSelection = useSpreadsheetStore((s) => s.setClipboardSelection);

  const colIndexOf = useCallback(
    (columnId: string) => visibleColumnIds.indexOf(columnId),
    [visibleColumnIds],
  );

  const getSelectedRange = useCallback((): SelectionRange | null => {
    if (selectionRange) return selectionRange;
    if (!activeCell) return null;
    return { start: activeCell, end: activeCell };
  }, [activeCell, selectionRange]);

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

  const handleCopy = useCallback(async (clipboardData?: DataTransfer | null) => {
    const data = readSelection();
    const range = getSelectedRange();
    if (data.length === 0 || !range) return;
    const tsv = toTsv(data);
    setClipboardSelection(range, "copy");

    if (clipboardData) {
      clipboardData.setData("text/plain", tsv);
      return;
    }

    await writeClipboardText(tsv);
  }, [getSelectedRange, readSelection, setClipboardSelection]);

  // Cut only marks the selection — cells are cleared when pasted (Excel behavior)
  const handleCut = useCallback(async (clipboardData?: DataTransfer | null) => {
    const data = readSelection();
    const range = getSelectedRange();
    if (data.length === 0 || !range) return;
    const tsv = toTsv(data);
    setClipboardSelection(range, "cut");

    if (clipboardData) {
      clipboardData.setData("text/plain", tsv);
      return;
    }

    await writeClipboardText(tsv);
  }, [getSelectedRange, readSelection, setClipboardSelection]);

  const handlePaste = useCallback(async (clipboardText?: string) => {
    if (!activeCell) return;
    let text = clipboardText;
    if (text == null) {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        return;
      }
    }
    const rows = parseTsv(text);
    if (rows.length === 0) return;

    const startRow = activeCell.rowIndex;
    const startCol = colIndexOf(activeCell.columnId);
    if (startCol === -1) return;

    // Use hf.batch() so the entire paste (+ cut clear) is a single undo step
    const applyPaste = () => {
      // Write pasted values
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

      // Clear cut source cells (deferred from handleCut)
      if (clipboardSelectionMode === "cut" && clipboardSelection) {
        const { start, end } = clipboardSelection;
        const sc = visibleColumnIds.indexOf(start.columnId);
        const ec = visibleColumnIds.indexOf(end.columnId);
        const minRow = Math.min(start.rowIndex, end.rowIndex);
        const maxRow = Math.max(start.rowIndex, end.rowIndex);
        const minCol = Math.min(sc, ec);
        const maxCol = Math.max(sc, ec);
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const colId = visibleColumnIds[c];
            if (!canEditCell(r, colId)) continue;
            meta?.updateData(r, colId, null);
            if (hf) {
              hf.setCellContents({ sheet: 0, row: r, col: letterToColIndex(colId) }, [[null]]);
            }
          }
        }
      }
    };

    if (hf) {
      hf.batch(() => applyPaste());
    } else {
      applyPaste();
    }
    incrementRenderTrigger();

    if (clipboardSelectionMode === "cut") {
      setClipboardSelection(null, null);
    }
  }, [activeCell, meta, colIndexOf, totalRowCount, visibleColumnIds, canEditCell, hf, incrementRenderTrigger, setClipboardSelection]);

  return { handleCopy, handleCut, handlePaste };
}
