import { useCallback, useRef, useEffect } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { HyperFormula } from "hyperformula";
import type {
  CellAddress,
  MergedCell,
  SpreadsheetTableMeta,
} from "@/types/spreadsheet-types";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { letterToColIndex } from "@/utils/cell-address";
import { didUndoRedoTouchMergeHistoryMarker } from "@/utils/formula-utils";
import {
  expandSelectionForMerges,
  getMergeLookupResult,
} from "@/utils/merge-cell-utils";

interface UseKeyboardNavigationParams {
  activeCell: CellAddress | null;
  editingCell: CellAddress | null;
  selectionRange: { start: CellAddress; end: CellAddress } | null;
  setActiveCell: (cell: CellAddress | null) => void;
  setSelection: (range: { start: CellAddress; end: CellAddress } | null) => void;
  startEditing: (cell: CellAddress, overwrite?: boolean) => void;
  /** Ordered visible column IDs (excluding _row_number) */
  visibleColumnIds: string[];
  totalRowCount: number;
  viewportRowCount: number;
  meta: SpreadsheetTableMeta | undefined;
  /** Check if a cell is editable before clearing */
  canEditCell: (rowIndex: number, columnId: string) => boolean;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  colVirtualizer: Virtualizer<HTMLDivElement, Element>;
  /** HyperFormula instance for undo/redo and cell clearing */
  hf: HyperFormula | null;
  incrementRenderTrigger: () => void;
  mergedCells: MergedCell[];
  mergedCellLookup: Map<string, number>;
  onToggleMerge?: () => void;
}

/**
 * Keyboard navigation for spreadsheet grid (non-editing mode).
 * Returns a keyDown handler to attach to the grid container.
 */
export function useKeyboardNavigation({
  activeCell,
  editingCell,
  selectionRange,
  setActiveCell,
  setSelection,
  startEditing,
  visibleColumnIds,
  totalRowCount,
  viewportRowCount,
  meta,
  canEditCell,
  rowVirtualizer,
  colVirtualizer,
  hf,
  incrementRenderTrigger,
  mergedCells,
  mergedCellLookup,
  onToggleMerge,
}: UseKeyboardNavigationParams) {
  const setClipboardSelection = useSpreadsheetStore((s) => s.setClipboardSelection);
  const undoMergeHistory = useSpreadsheetStore((s) => s.undoMergeHistory);
  const redoMergeHistory = useSpreadsheetStore((s) => s.redoMergeHistory);
  const colCount = visibleColumnIds.length;
  const maxRow = totalRowCount - 1;
  const maxCol = colCount - 1;

  /** Clamp a cell address to grid bounds */
  const clamp = useCallback(
    (row: number, colIdx: number): CellAddress => ({
      rowIndex: Math.max(0, Math.min(row, maxRow)),
      columnId: visibleColumnIds[Math.max(0, Math.min(colIdx, maxCol))],
    }),
    [maxRow, maxCol, visibleColumnIds],
  );

  const colIndexOf = useCallback(
    (columnId: string) => visibleColumnIds.indexOf(columnId),
    [visibleColumnIds],
  );

  const getMergeAt = useCallback(
    (row: number, colIndex: number) =>
      getMergeLookupResult(mergedCells, mergedCellLookup, row, colIndex),
    [mergedCellLookup, mergedCells],
  );

  const normalizeToAnchor = useCallback(
    (row: number, colIndex: number) => {
      const merge = getMergeAt(row, colIndex);
      if (!merge) return { row, colIndex };
      return { row: merge.merge.row, colIndex: merge.merge.col };
    },
    [getMergeAt],
  );

  const normalizeCellAddress = useCallback(
    (cell: CellAddress): CellAddress => {
      const colIndex = colIndexOf(cell.columnId);
      if (colIndex === -1) return cell;
      const normalized = normalizeToAnchor(cell.rowIndex, colIndex);
      return clamp(normalized.row, normalized.colIndex);
    },
    [clamp, colIndexOf, normalizeToAnchor],
  );

  const setExpandedSelection = useCallback(
    (range: { start: CellAddress; end: CellAddress } | null) => {
      if (!range) {
        setSelection(null);
        return;
      }
      setSelection(
        expandSelectionForMerges(range, visibleColumnIds, mergedCells),
      );
    },
    [mergedCells, setSelection, visibleColumnIds],
  );

  /** Move activeCell with merge-aware arrow behavior. */
  const move = useCallback(
    (direction: "up" | "down" | "left" | "right", extend: boolean) => {
      if (!activeCell) return;
      const initialCol = colIndexOf(activeCell.columnId);
      if (initialCol === -1) return;

      const normalized = normalizeToAnchor(activeCell.rowIndex, initialCol);
      let nextRow = normalized.row;
      let nextCol = normalized.colIndex;
      const currentMerge = getMergeAt(normalized.row, normalized.colIndex);

      switch (direction) {
        case "up":
          nextRow = currentMerge?.isAnchor
            ? currentMerge.merge.row - 1
            : normalized.row - 1;
          break;
        case "down":
          nextRow = currentMerge?.isAnchor
            ? currentMerge.merge.row + currentMerge.merge.rowSpan
            : normalized.row + 1;
          break;
        case "left":
          nextCol = currentMerge?.isAnchor
            ? currentMerge.merge.col - 1
            : normalized.colIndex - 1;
          break;
        case "right":
          nextCol = currentMerge?.isAnchor
            ? currentMerge.merge.col + currentMerge.merge.colSpan
            : normalized.colIndex + 1;
          break;
      }

      const clamped = clamp(nextRow, nextCol);
      const snapped = normalizeToAnchor(
        clamped.rowIndex,
        colIndexOf(clamped.columnId),
      );
      const nextCell = normalizeCellAddress(clamp(snapped.row, snapped.colIndex));

      if (extend) {
        const anchor = normalizeCellAddress(selectionRange?.start ?? activeCell);
        setExpandedSelection({ start: anchor, end: nextCell });
      } else {
        setExpandedSelection(null);
      }
      setActiveCell(nextCell);
    },
    [
      activeCell,
      clamp,
      colIndexOf,
      getMergeAt,
      normalizeCellAddress,
      normalizeToAnchor,
      selectionRange,
      setActiveCell,
      setExpandedSelection,
    ],
  );

  /** Move activeCell with merge-aware Tab behavior (skip covered cells). */
  const moveTab = useCallback(
    (backward: boolean) => {
      if (!activeCell) return;
      const startCol = colIndexOf(activeCell.columnId);
      if (startCol === -1) return;

      const normalized = normalizeToAnchor(activeCell.rowIndex, startCol);
      let row = normalized.row;
      let col = normalized.colIndex;
      const step = backward ? -1 : 1;
      const currentMerge = getMergeAt(row, col);

      if (currentMerge?.isAnchor) {
        col = backward
          ? currentMerge.merge.col - 1
          : currentMerge.merge.col + currentMerge.merge.colSpan;
      } else {
        col += step;
      }

      for (let i = 0; i < totalRowCount * Math.max(1, colCount); i++) {
        if (col < 0) {
          col = maxCol;
          row -= 1;
        } else if (col > maxCol) {
          col = 0;
          row += 1;
        }

        if (row < 0) {
          setActiveCell(normalizeCellAddress(clamp(0, 0)));
          setExpandedSelection(null);
          return;
        }
        if (row > maxRow) {
          setActiveCell(normalizeCellAddress(clamp(maxRow, maxCol)));
          setExpandedSelection(null);
          return;
        }

        const merge = getMergeAt(row, col);
        if (!merge || merge.isAnchor) {
          const nextCell = normalizeCellAddress(clamp(row, col));
          setActiveCell(nextCell);
          setExpandedSelection(null);
          return;
        }

        col = backward ? merge.merge.col - 1 : merge.merge.col + merge.merge.colSpan;
      }
    },
    [
      activeCell,
      clamp,
      colCount,
      colIndexOf,
      getMergeAt,
      maxCol,
      maxRow,
      normalizeToAnchor,
      normalizeCellAddress,
      setActiveCell,
      setExpandedSelection,
      totalRowCount,
    ],
  );

  /** Scroll to keep activeCell visible (both row and column) */
  const scrollToCell = useCallback(
    (cell: CellAddress) => {
      rowVirtualizer.scrollToIndex(cell.rowIndex, { align: "auto" });
      const ci = visibleColumnIds.indexOf(cell.columnId);
      if (ci !== -1) colVirtualizer.scrollToIndex(ci, { align: "auto" });
    },
    [rowVirtualizer, colVirtualizer, visibleColumnIds],
  );

  // Auto-scroll when activeCell changes
  const prevActiveCellRef = useRef(activeCell);
  useEffect(() => {
    if (activeCell && activeCell !== prevActiveCellRef.current) {
      scrollToCell(activeCell);
    }
    prevActiveCellRef.current = activeCell;
  }, [activeCell, scrollToCell]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Let editors handle their own keys
      if (editingCell) return;
      if (colCount === 0 || totalRowCount === 0) return;

      // If no active cell, activate first cell
      if (!activeCell) {
        setActiveCell(normalizeCellAddress({ rowIndex: 0, columnId: visibleColumnIds[0] }));
        return;
      }

      const shift = e.shiftKey;
      const ctrl = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();
      const curCol = colIndexOf(activeCell.columnId);
      if (curCol === -1) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          move("up", shift);
          break;
        case "ArrowDown":
          e.preventDefault();
          move("down", shift);
          break;
        case "ArrowLeft":
          e.preventDefault();
          move("left", shift);
          break;
        case "ArrowRight":
          e.preventDefault();
          move("right", shift);
          break;

        case "Tab": {
          e.preventDefault();
          moveTab(shift);
          break;
        }

        case "Enter":
          e.preventDefault();
          if (shift) {
            move("up", false);
          } else {
            // Enter on non-editing cell: start editing
            startEditing(activeCell);
          }
          break;

        case "Home":
          e.preventDefault();
          if (ctrl) {
            // Ctrl+Home → first cell
            const first = normalizeCellAddress({
              rowIndex: 0,
              columnId: visibleColumnIds[0],
            });
            setActiveCell(first);
            setExpandedSelection(
              shift ? { start: selectionRange?.start ?? activeCell, end: first } : null,
            );
          } else {
            // Home → first column in row
            const first = normalizeCellAddress({
              rowIndex: activeCell.rowIndex,
              columnId: visibleColumnIds[0],
            });
            setActiveCell(first);
            setExpandedSelection(
              shift ? { start: selectionRange?.start ?? activeCell, end: first } : null,
            );
          }
          break;

        case "End":
          e.preventDefault();
          if (ctrl) {
            // Ctrl+End → last cell
            const last = normalizeCellAddress({
              rowIndex: maxRow,
              columnId: visibleColumnIds[maxCol],
            });
            setActiveCell(last);
            setExpandedSelection(
              shift ? { start: selectionRange?.start ?? activeCell, end: last } : null,
            );
          } else {
            // End → last column in row
            const last = normalizeCellAddress({
              rowIndex: activeCell.rowIndex,
              columnId: visibleColumnIds[maxCol],
            });
            setActiveCell(last);
            setExpandedSelection(
              shift ? { start: selectionRange?.start ?? activeCell, end: last } : null,
            );
          }
          break;

        case "PageUp":
          e.preventDefault();
          {
            const end = normalizeCellAddress(
              clamp(activeCell.rowIndex - viewportRowCount, curCol),
            );
            setActiveCell(end);
            setExpandedSelection(
              shift ? { start: selectionRange?.start ?? activeCell, end } : null,
            );
          }
          break;

        case "PageDown":
          e.preventDefault();
          {
            const end = normalizeCellAddress(
              clamp(activeCell.rowIndex + viewportRowCount, curCol),
            );
            setActiveCell(end);
            setExpandedSelection(
              shift ? { start: selectionRange?.start ?? activeCell, end } : null,
            );
          }
          break;

        case "F2":
          e.preventDefault();
          startEditing(activeCell);
          break;

        case "Escape":
          e.preventDefault();
          if (selectionRange) {
            setExpandedSelection(null);
          }
          // Clear clipboard marching ants (copy/cut border)
          setClipboardSelection(null, null);
          break;

        case "Delete":
        case "Backspace": {
          e.preventDefault();
          // Clear selected cells — route through HyperFormula if available
          if (selectionRange) {
            const { start, end } = selectionRange;
            const minRow = Math.min(start.rowIndex, end.rowIndex);
            const maxRowSel = Math.max(start.rowIndex, end.rowIndex);
            const startCol = colIndexOf(start.columnId);
            const endCol = colIndexOf(end.columnId);
            const minColSel = Math.min(startCol, endCol);
            const maxColSel = Math.max(startCol, endCol);

              if (hf) hf.suspendEvaluation();
              for (let r = minRow; r <= maxRowSel; r++) {
                for (let c = minColSel; c <= maxColSel; c++) {
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
            } else if (activeCell && canEditCell(activeCell.rowIndex, activeCell.columnId)) {
              if (meta?.updateData(activeCell.rowIndex, activeCell.columnId, null) === false) {
                break;
              }
              if (hf) {
                hf.setCellContents(
                  { sheet: 0, row: activeCell.rowIndex, col: letterToColIndex(activeCell.columnId) },
                  [[null]],
                );
                incrementRenderTrigger();
              }
            }
            break;
          }

        default:
          // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y → Undo/Redo (via HyperFormula)
          if (ctrl && keyLower === "z" && hf) {
            e.preventDefault();
            if (e.shiftKey) {
              if (hf.isThereSomethingToRedo()) {
                try {
                  const changes = hf.redo();
                  if (didUndoRedoTouchMergeHistoryMarker(hf, changes)) {
                    redoMergeHistory?.();
                  }
                  incrementRenderTrigger();
                  meta?.syncFromFormulaEngine?.();
                } catch (error) {
                  console.error("Redo failed:", error);
                }
              }
            } else if (hf.isThereSomethingToUndo()) {
              try {
                const changes = hf.undo();
                if (didUndoRedoTouchMergeHistoryMarker(hf, changes)) {
                  undoMergeHistory?.();
                }
                incrementRenderTrigger();
                meta?.syncFromFormulaEngine?.();
              } catch (error) {
                console.error("Undo failed:", error);
              }
            }
            break;
          }
          if (ctrl && keyLower === "y" && hf) {
            e.preventDefault();
            if (hf.isThereSomethingToRedo()) {
              try {
                const changes = hf.redo();
                if (didUndoRedoTouchMergeHistoryMarker(hf, changes)) {
                  redoMergeHistory?.();
                }
                incrementRenderTrigger();
                meta?.syncFromFormulaEngine?.();
              } catch (error) {
                console.error("Redo failed:", error);
              }
            }
            break;
          }
          if (ctrl && keyLower === "m") {
            e.preventDefault();
            onToggleMerge?.();
            break;
          }
          // Ctrl+A → select all
          if (ctrl && keyLower === "a") {
            e.preventDefault();
            setExpandedSelection({
              start: { rowIndex: 0, columnId: visibleColumnIds[0] },
              end: { rowIndex: maxRow, columnId: visibleColumnIds[maxCol] },
            });
          }
          break;
      }

      // Type-to-edit: printable character starts editing in overwrite mode
      // Ctrl combos (copy/paste/selectAll) are excluded by !ctrl check
      if (e.key.length === 1 && !ctrl && !e.altKey && !e.defaultPrevented) {
        e.preventDefault();
        startEditing(activeCell, true);
      }
    },
    [
      editingCell, activeCell, colCount, totalRowCount, visibleColumnIds,
      colIndexOf, move, moveTab, clamp, maxRow, maxCol, viewportRowCount,
        normalizeCellAddress, setActiveCell, setExpandedSelection, startEditing,
        selectionRange, meta, canEditCell, hf, incrementRenderTrigger,
        setClipboardSelection, onToggleMerge, undoMergeHistory, redoMergeHistory,
        ],
    );

  return { handleKeyDown };
}
