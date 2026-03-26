import { useCallback, useRef, useEffect } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { HyperFormula } from "hyperformula";
import type { CellAddress, SpreadsheetTableMeta } from "@/types/spreadsheet-types";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { letterToColIndex } from "@/utils/cell-address";

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
}: UseKeyboardNavigationParams) {
  const setClipboardSelection = useSpreadsheetStore((s) => s.setClipboardSelection);
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

  /** Move activeCell by delta, optionally extending selection */
  const move = useCallback(
    (dRow: number, dCol: number, extend: boolean) => {
      if (!activeCell) return;
      const curCol = colIndexOf(activeCell.columnId);
      if (curCol === -1) return;

      const nextCell = clamp(activeCell.rowIndex + dRow, curCol + dCol);

      if (extend) {
        // Extend selection from anchor
        const anchor = selectionRange?.start ?? activeCell;
        setSelection({ start: anchor, end: nextCell });
      } else {
        setSelection(null);
      }
      setActiveCell(nextCell);
    },
    [activeCell, colIndexOf, clamp, selectionRange, setActiveCell, setSelection],
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
        setActiveCell({ rowIndex: 0, columnId: visibleColumnIds[0] });
        return;
      }

      const shift = e.shiftKey;
      const ctrl = e.ctrlKey || e.metaKey;
      const curCol = colIndexOf(activeCell.columnId);

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          move(-1, 0, shift);
          break;
        case "ArrowDown":
          e.preventDefault();
          move(1, 0, shift);
          break;
        case "ArrowLeft":
          e.preventDefault();
          move(0, -1, shift);
          break;
        case "ArrowRight":
          e.preventDefault();
          move(0, 1, shift);
          break;

        case "Tab": {
          e.preventDefault();
          const dir = shift ? -1 : 1;
          let nextCol = curCol + dir;
          let nextRow = activeCell.rowIndex;
          // Wrap to next/prev row
          if (nextCol > maxCol) {
            nextCol = 0;
            nextRow = Math.min(nextRow + 1, maxRow);
          } else if (nextCol < 0) {
            nextCol = maxCol;
            nextRow = Math.max(nextRow - 1, 0);
          }
          const next = clamp(nextRow, nextCol);
          setActiveCell(next);
          setSelection(null);
          break;
        }

        case "Enter":
          e.preventDefault();
          if (shift) {
            move(-1, 0, false);
          } else {
            // Enter on non-editing cell: start editing
            startEditing(activeCell);
          }
          break;

        case "Home":
          e.preventDefault();
          if (ctrl) {
            // Ctrl+Home → first cell
            const first = { rowIndex: 0, columnId: visibleColumnIds[0] };
            setActiveCell(first);
            setSelection(shift ? { start: activeCell, end: first } : null);
          } else {
            // Home → first column in row
            const first = { rowIndex: activeCell.rowIndex, columnId: visibleColumnIds[0] };
            setActiveCell(first);
            setSelection(shift ? { start: activeCell, end: first } : null);
          }
          break;

        case "End":
          e.preventDefault();
          if (ctrl) {
            // Ctrl+End → last cell
            const last = { rowIndex: maxRow, columnId: visibleColumnIds[maxCol] };
            setActiveCell(last);
            setSelection(shift ? { start: activeCell, end: last } : null);
          } else {
            // End → last column in row
            const last = { rowIndex: activeCell.rowIndex, columnId: visibleColumnIds[maxCol] };
            setActiveCell(last);
            setSelection(shift ? { start: activeCell, end: last } : null);
          }
          break;

        case "PageUp":
          e.preventDefault();
          move(-viewportRowCount, 0, shift);
          break;

        case "PageDown":
          e.preventDefault();
          move(viewportRowCount, 0, shift);
          break;

        case "F2":
          e.preventDefault();
          startEditing(activeCell);
          break;

        case "Escape":
          e.preventDefault();
          if (selectionRange) {
            setSelection(null);
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
          // Ctrl+Z → Undo, Ctrl+Y → Redo (via HyperFormula)
          if (ctrl && e.key === "z" && hf) {
            e.preventDefault();
            if (hf.isThereSomethingToUndo()) {
              hf.undo();
              incrementRenderTrigger();
            }
            break;
          }
          if (ctrl && e.key === "y" && hf) {
            e.preventDefault();
            if (hf.isThereSomethingToRedo()) {
              hf.redo();
              incrementRenderTrigger();
            }
            break;
          }
          // Ctrl+A → select all
          if (ctrl && e.key === "a") {
            e.preventDefault();
            setSelection({
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
      colIndexOf, move, clamp, maxRow, maxCol, viewportRowCount,
      setActiveCell, setSelection, startEditing, selectionRange, meta, canEditCell,
      hf, incrementRenderTrigger,
    ],
  );

  return { handleKeyDown };
}
