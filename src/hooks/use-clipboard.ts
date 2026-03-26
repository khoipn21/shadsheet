import { useCallback } from "react";
import type { HyperFormula } from "hyperformula";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import type { CellAddress, CellValue, SelectionRange, SpreadsheetTableMeta } from "@/types/spreadsheet-types";
import { letterToColIndex } from "@/utils/cell-address";
import { appendMergeHistoryMarker } from "@/utils/formula-utils";
import {
  findMergesIntersectingBounds,
  getMergeLookupResult,
  type SelectionBounds,
} from "@/utils/merge-cell-utils";

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
  const mergedCells = useSpreadsheetStore((s) => s.mergedCells);
  const mergedCellLookup = useSpreadsheetStore((s) => s.mergedCellLookup);
  const unmergeCells = useSpreadsheetStore((s) => s.unmergeCells);
  const recordMergeHistory = useSpreadsheetStore((s) => s.recordMergeHistory);

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
      if (sc === -1 || ec === -1) return null;
      return {
        minRow: Math.min(start.rowIndex, end.rowIndex),
        maxRow: Math.max(start.rowIndex, end.rowIndex),
        minCol: Math.min(sc, ec),
        maxCol: Math.max(sc, ec),
      };
    }
    if (activeCell) {
      const c = colIndexOf(activeCell.columnId);
      if (c === -1) return null;
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
        const merge = getMergeLookupResult(mergedCells, mergedCellLookup, r, c);
        if (merge && !merge.isAnchor) {
          row.push("");
          continue;
        }
        row.push(getCellValue(r, visibleColumnIds[c]));
      }
      result.push(row);
    }
    return result;
  }, [getBounds, getCellValue, mergedCellLookup, mergedCells, visibleColumnIds]);

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
    const maxPasteWidth = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const pasteBounds: SelectionBounds = {
      minRow: startRow,
      maxRow: Math.min(totalRowCount - 1, startRow + rows.length - 1),
      minCol: startCol,
      maxCol: Math.min(visibleColumnIds.length - 1, startCol + maxPasteWidth - 1),
    };
    const overlappingMerges = findMergesIntersectingBounds(mergedCells, pasteBounds);
    const mergeSnapshotBefore = mergedCells.map((merge) => ({ ...merge }));

    type CellWrite = { row: number; columnId: string; value: CellValue };
    const targetWrites: CellWrite[] = [];
    for (let r = 0; r < rows.length; r++) {
      const targetRow = startRow + r;
      if (targetRow >= totalRowCount) break;
      for (let c = 0; c < rows[r].length; c++) {
        const targetCol = startCol + c;
        if (targetCol >= visibleColumnIds.length) break;
        const columnId = visibleColumnIds[targetCol];
        if (!canEditCell(targetRow, columnId)) continue;
        targetWrites.push({ row: targetRow, columnId, value: rows[r][c] });
      }
    }

    let clearWrites: CellWrite[] = [];
    let sourceMerges = [] as ReturnType<typeof findMergesIntersectingBounds>;
    if (clipboardSelectionMode === "cut" && clipboardSelection) {
      const { start, end } = clipboardSelection;
      const sc = visibleColumnIds.indexOf(start.columnId);
      const ec = visibleColumnIds.indexOf(end.columnId);
      if (sc !== -1 && ec !== -1) {
        const minRow = Math.min(start.rowIndex, end.rowIndex);
        const maxRow = Math.max(start.rowIndex, end.rowIndex);
        const minCol = Math.min(sc, ec);
        const maxCol = Math.max(sc, ec);
        const cutBounds: SelectionBounds = { minRow, maxRow, minCol, maxCol };
        sourceMerges = findMergesIntersectingBounds(mergedCells, cutBounds);
        const writableSource: CellWrite[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const columnId = visibleColumnIds[c];
            if (!canEditCell(r, columnId)) continue;
            writableSource.push({ row: r, columnId, value: null });
          }
        }
        clearWrites = writableSource;
      }
    }

    const shouldUnmergePasteTargets = targetWrites.length > 0;
    const shouldProcessCutSource =
      clipboardSelectionMode === "cut" &&
      targetWrites.length > 0 &&
      clearWrites.length > 0;
    const shouldUnmergeCutSource = shouldProcessCutSource;
    const mergesToUnmerge = new Map<string, { row: number; col: number }>();
    if (shouldUnmergePasteTargets) {
      for (const merge of overlappingMerges) {
        mergesToUnmerge.set(`${merge.row}-${merge.col}`, { row: merge.row, col: merge.col });
      }
    }
    if (shouldUnmergeCutSource) {
      for (const merge of sourceMerges) {
        mergesToUnmerge.set(`${merge.row}-${merge.col}`, { row: merge.row, col: merge.col });
      }
    }
    const hasMergeMutation = mergesToUnmerge.size > 0;

    // Use hf.batch() so the entire paste (+ cut clear + merge mutation marker) is a single undo step.
    const applyPaste = () => {
      if (hasMergeMutation) {
        for (const merge of mergesToUnmerge.values()) {
          unmergeCells(merge.row, merge.col);
        }
        if (hf) {
          try {
            appendMergeHistoryMarker(hf);
          } catch {
            // Keep paste functional even if marker bookkeeping fails.
          }
        }
      }

      for (const write of targetWrites) {
        if (meta?.updateData(write.row, write.columnId, write.value) === false) continue;
        if (hf) {
          hf.setCellContents(
            {
              sheet: 0,
              row: write.row,
              col: letterToColIndex(write.columnId),
            },
            [[write.value]],
          );
        }
      }

      if (shouldProcessCutSource) {
        for (const write of clearWrites) {
          if (meta?.updateData(write.row, write.columnId, null) === false) continue;
          if (hf) {
            hf.setCellContents(
              {
                sheet: 0,
                row: write.row,
                col: letterToColIndex(write.columnId),
              },
              [[null]],
            );
          }
        }
      }
    };

    if (hf) {
      hf.batch(() => applyPaste());
    } else {
      applyPaste();
    }
    if (hasMergeMutation) {
      recordMergeHistory?.(mergeSnapshotBefore);
    }
    incrementRenderTrigger();

    if (clipboardSelectionMode === "cut" && targetWrites.length > 0) {
      setClipboardSelection(null, null);
    }
  }, [activeCell, meta, colIndexOf, totalRowCount, visibleColumnIds, canEditCell, hf, recordMergeHistory, incrementRenderTrigger, setClipboardSelection, clipboardSelectionMode, clipboardSelection, mergedCells, unmergeCells]);

  return { handleCopy, handleCut, handlePaste };
}
