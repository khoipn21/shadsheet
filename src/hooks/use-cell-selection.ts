import { useCallback, useRef } from "react";
import type { CellAddress, SelectionRange } from "@/types/spreadsheet-types";

interface UseCellSelectionParams {
  activeCell: CellAddress | null;
  setActiveCell: (cell: CellAddress | null) => void;
  setSelection: (range: SelectionRange | null) => void;
}

/**
 * Mouse-based cell selection: click, Shift+click, click+drag, Ctrl+A.
 * Returns handlers to attach to CellRenderer and the grid container.
 */
export function useCellSelection({
  activeCell,
  setActiveCell,
  setSelection,
}: UseCellSelectionParams) {
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<CellAddress | null>(null);

  /** Single click on a cell */
  const handleCellMouseDown = useCallback(
    (rowIndex: number, columnId: string, shiftKey: boolean) => {
      const cell: CellAddress = { rowIndex, columnId };

      if (shiftKey && activeCell) {
        // Shift+click → extend selection from activeCell to clicked cell
        setSelection({ start: activeCell, end: cell });
      } else {
        // Normal click → set active, clear selection, start potential drag
        setActiveCell(cell);
        setSelection(null);
        dragStartRef.current = cell;
        isDraggingRef.current = true;
      }
    },
    [activeCell, setActiveCell, setSelection],
  );

  /** Mouse enters a cell while dragging → update selection end */
  const handleCellMouseEnter = useCallback(
    (rowIndex: number, columnId: string) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;
      const end: CellAddress = { rowIndex, columnId };
      setSelection({ start: dragStartRef.current, end });
    },
    [setSelection],
  );

  /** Mouse up anywhere → finalize drag */
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return {
    handleCellMouseDown,
    handleCellMouseEnter,
    handleMouseUp,
  };
}
