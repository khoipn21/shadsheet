import { useCallback, useRef } from "react";
import type {
  CellAddress,
  MergedCell,
  SelectionRange,
} from "@/types/spreadsheet-types";
import {
  expandSelectionForMerges,
  getMergeEndCol,
  getMergeEndRow,
  getMergeLookupResult,
  snapCellToMergeAnchor,
} from "@/utils/merge-cell-utils";

interface UseCellSelectionParams {
  activeCell: CellAddress | null;
  setActiveCell: (cell: CellAddress | null) => void;
  setSelection: (range: SelectionRange | null) => void;
  visibleColumnIds: string[];
  mergedCells: MergedCell[];
  mergedCellLookup: Map<string, number>;
}

/**
 * Mouse-based cell selection: click, Shift+click, click+drag, Ctrl+A.
 * Returns handlers to attach to CellRenderer and the grid container.
 */
export function useCellSelection({
  activeCell,
  setActiveCell,
  setSelection,
  visibleColumnIds,
  mergedCells,
  mergedCellLookup,
}: UseCellSelectionParams) {
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<CellAddress | null>(null);

  const getMergedRangeAtCell = useCallback(
    (cell: CellAddress): SelectionRange | null => {
      const colIndex = visibleColumnIds.indexOf(cell.columnId);
      if (colIndex === -1) return null;
      const lookup = getMergeLookupResult(
        mergedCells,
        mergedCellLookup,
        cell.rowIndex,
        colIndex,
      );
      if (!lookup) return null;

      const startColumnId = visibleColumnIds[lookup.merge.col];
      const endColumnId = visibleColumnIds[getMergeEndCol(lookup.merge)];
      if (!startColumnId || !endColumnId) return null;

      return {
        start: { rowIndex: lookup.merge.row, columnId: startColumnId },
        end: {
          rowIndex: getMergeEndRow(lookup.merge),
          columnId: endColumnId,
        },
      };
    },
    [mergedCellLookup, mergedCells, visibleColumnIds],
  );

  const normalizeCellAddress = useCallback(
    (cell: CellAddress): CellAddress =>
      snapCellToMergeAnchor(cell, visibleColumnIds, mergedCells, mergedCellLookup),
    [mergedCellLookup, mergedCells, visibleColumnIds],
  );

  /** Single click on a cell */
  const handleCellMouseDown = useCallback(
    (rowIndex: number, columnId: string, shiftKey: boolean) => {
      const rawCell: CellAddress = { rowIndex, columnId };
      const cell = normalizeCellAddress(rawCell);

      if (shiftKey && activeCell) {
        // Shift+click → extend selection from activeCell to clicked cell
        const anchor = normalizeCellAddress(activeCell);
        setSelection(
          expandSelectionForMerges(
            { start: anchor, end: cell },
            visibleColumnIds,
            mergedCells,
          ),
        );
        setActiveCell(anchor);
      } else {
        // Normal click → set active, clear selection, start potential drag
        setActiveCell(cell);
        setSelection(getMergedRangeAtCell(cell));
        dragStartRef.current = cell;
        isDraggingRef.current = true;
      }
    },
    [
      activeCell,
      getMergedRangeAtCell,
      mergedCells,
      normalizeCellAddress,
      setActiveCell,
      setSelection,
      visibleColumnIds,
    ],
  );

  /** Mouse enters a cell while dragging → update selection end */
  const handleCellMouseEnter = useCallback(
    (rowIndex: number, columnId: string) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;
      const end: CellAddress = normalizeCellAddress({ rowIndex, columnId });
      setSelection(
        expandSelectionForMerges(
          { start: dragStartRef.current, end },
          visibleColumnIds,
          mergedCells,
        ),
      );
    },
    [mergedCells, normalizeCellAddress, setSelection, visibleColumnIds],
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
