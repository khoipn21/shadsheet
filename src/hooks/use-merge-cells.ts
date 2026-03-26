import { useCallback, useMemo } from "react";
import { useHyperFormula } from "@/hooks/use-hyperformula";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import type { CellValue, MergedCell, SelectionRange } from "@/types/spreadsheet-types";
import { letterToColIndex } from "@/utils/cell-address";
import { appendMergeHistoryMarker } from "@/utils/formula-utils";
import {
  boundsToSelectionRange,
  getMergeLookupResult,
  selectionRangeToBounds,
  selectionToMergeRegion,
} from "@/utils/merge-cell-utils";

interface UseMergeCellsOptions {
  visibleColumnIds: string[];
  leftPinnedCount?: number;
  centerCount?: number;
  onClearCellValue?: (rowIndex: number, columnId: string, value: CellValue) => boolean;
}

type PaneName = "left" | "center" | "right";

function paneForColumn(
  colIndex: number,
  leftPinnedCount: number,
  centerCount: number,
): PaneName {
  if (colIndex < leftPinnedCount) return "left";
  if (colIndex < leftPinnedCount + centerCount) return "center";
  return "right";
}

function selectionFromActiveCell(
  activeCell: { rowIndex: number; columnId: string } | null,
): SelectionRange | null {
  if (!activeCell) return null;
  return { start: activeCell, end: activeCell };
}

export function useMergeCells({
  visibleColumnIds,
  leftPinnedCount = 0,
  centerCount = visibleColumnIds.length,
  onClearCellValue,
}: UseMergeCellsOptions) {
  const hf = useHyperFormula();
  const activeCell = useSpreadsheetStore((s) => s.activeCell);
  const selectionRange = useSpreadsheetStore((s) => s.selectionRange);
  const setActiveCell = useSpreadsheetStore((s) => s.setActiveCell);
  const setSelection = useSpreadsheetStore((s) => s.setSelection);
  const incrementRenderTrigger = useSpreadsheetStore((s) => s.incrementRenderTrigger);
  const mergedCells = useSpreadsheetStore((s) => s.mergedCells);
  const mergedCellLookup = useSpreadsheetStore((s) => s.mergedCellLookup);
  const mergeCellsInStore = useSpreadsheetStore((s) => s.mergeCells);
  const unmergeCellsInStore = useSpreadsheetStore((s) => s.unmergeCells);
  const recordMergeHistory = useSpreadsheetStore((s) => s.recordMergeHistory);

  const resolveRange = useCallback(
    (inputRange?: SelectionRange | null): SelectionRange | null =>
      inputRange ?? selectionRange ?? selectionFromActiveCell(activeCell),
    [activeCell, selectionRange],
  );

  const isSinglePaneRegion = useCallback(
    (region: MergedCell): boolean => {
      const startPane = paneForColumn(region.col, leftPinnedCount, centerCount);
      const endPane = paneForColumn(
        region.col + region.colSpan - 1,
        leftPinnedCount,
        centerCount,
      );
      return startPane === endPane;
    },
    [centerCount, leftPinnedCount],
  );

  const clearCoveredValues = useCallback(
    (merge: MergedCell) => {
      for (let row = merge.row; row < merge.row + merge.rowSpan; row++) {
        for (let col = merge.col; col < merge.col + merge.colSpan; col++) {
          if (row === merge.row && col === merge.col) continue;
          const columnId = visibleColumnIds[col];
          if (!columnId) continue;
          const accepted = onClearCellValue?.(row, columnId, null) !== false;
          if (!accepted || !hf) continue;
          hf.setCellContents(
            { sheet: 0, row, col: letterToColIndex(columnId) },
            [[null]],
          );
        }
      }
    },
    [hf, onClearCellValue, visibleColumnIds],
  );

  const merge = useCallback(
    (inputRange?: SelectionRange | null): boolean => {
      const range = resolveRange(inputRange);
      if (!range) return false;

      const mergeRegion = selectionToMergeRegion(range, visibleColumnIds);
      if (!mergeRegion) return false;
      if (mergeRegion.rowSpan * mergeRegion.colSpan < 2) return false;
      if (!isSinglePaneRegion(mergeRegion)) return false;

      const mergeSnapshotBefore = mergedCells.map((mergeEntry) => ({ ...mergeEntry }));
      if (hf) {
        hf.batch(() => {
          clearCoveredValues(mergeRegion);
          try {
            appendMergeHistoryMarker(hf);
          } catch {
            // Keep merge functional even if marker bookkeeping fails.
          }
        });
      } else {
        clearCoveredValues(mergeRegion);
      }
      mergeCellsInStore(range, visibleColumnIds);
      recordMergeHistory?.(mergeSnapshotBefore);
      incrementRenderTrigger();

      const normalizedBounds = selectionRangeToBounds(range, visibleColumnIds);
      if (normalizedBounds) {
        const normalizedRange = boundsToSelectionRange(normalizedBounds, visibleColumnIds);
        if (normalizedRange) {
          setSelection(normalizedRange);
        }
      }
      setActiveCell({
        rowIndex: mergeRegion.row,
        columnId: visibleColumnIds[mergeRegion.col] ?? range.start.columnId,
      });

      return true;
    },
    [
      clearCoveredValues,
      hf,
      incrementRenderTrigger,
      isSinglePaneRegion,
      mergeCellsInStore,
      mergedCells,
      recordMergeHistory,
      resolveRange,
      setActiveCell,
      setSelection,
      visibleColumnIds,
    ],
  );

  const unmerge = useCallback(
    (row: number, col: number): boolean => {
      const lookup = getMergeLookupResult(mergedCells, mergedCellLookup, row, col);
      if (!lookup) return false;

      const mergeSnapshotBefore = mergedCells.map((mergeEntry) => ({ ...mergeEntry }));
      // Do NOT clear cell values when unmerging - cells were already cleared during merge
      // Just remove the merge metadata and let HyperFormula's undo handle value restoration
      if (hf) {
        try {
          appendMergeHistoryMarker(hf);
        } catch {
          // Keep unmerge functional even if marker bookkeeping fails.
        }
      }
      unmergeCellsInStore(lookup.merge.row, lookup.merge.col);
      recordMergeHistory?.(mergeSnapshotBefore);
      incrementRenderTrigger();
      return true;
    },
    [
      hf,
      incrementRenderTrigger,
      mergedCellLookup,
      mergedCells,
      recordMergeHistory,
      unmergeCellsInStore,
    ],
  );

  const isSelectionExactlyMerged = useCallback(
    (inputRange?: SelectionRange | null): boolean => {
      const range = resolveRange(inputRange);
      if (!range) return false;
      const region = selectionToMergeRegion(range, visibleColumnIds);
      if (!region) return false;

      const lookup = getMergeLookupResult(
        mergedCells,
        mergedCellLookup,
        region.row,
        region.col,
      );
      if (!lookup || !lookup.isAnchor) return false;
      return (
        lookup.merge.row === region.row &&
        lookup.merge.col === region.col &&
        lookup.merge.rowSpan === region.rowSpan &&
        lookup.merge.colSpan === region.colSpan
      );
    },
    [mergedCellLookup, mergedCells, resolveRange, visibleColumnIds],
  );

  const toggleMerge = useCallback(
    (inputRange?: SelectionRange | null): boolean => {
      const range = resolveRange(inputRange);
      if (!range) return false;

      if (isSelectionExactlyMerged(range)) {
        const region = selectionToMergeRegion(range, visibleColumnIds);
        if (!region) return false;
        return unmerge(region.row, region.col);
      }

      const probeCell = range.start ?? activeCell;
      const isSingleCellSelection =
        range.start.rowIndex === range.end.rowIndex &&
        range.start.columnId === range.end.columnId;
      if (probeCell) {
        const probeCol = visibleColumnIds.indexOf(probeCell.columnId);
        if (probeCol !== -1) {
          const lookup = getMergeLookupResult(
            mergedCells,
            mergedCellLookup,
            probeCell.rowIndex,
            probeCol,
          );
          if (lookup && isSingleCellSelection) {
            return unmerge(lookup.merge.row, lookup.merge.col);
          }
        }
      }

      return merge(range);
    },
    [
      activeCell,
      isSelectionExactlyMerged,
      merge,
      mergedCellLookup,
      mergedCells,
      resolveRange,
      unmerge,
      visibleColumnIds,
    ],
  );

  const canMergeSelection = useMemo(() => {
    const range = resolveRange();
    if (!range) return false;
    const region = selectionToMergeRegion(range, visibleColumnIds);
    if (!region) return false;
    return region.rowSpan * region.colSpan >= 2 && isSinglePaneRegion(region);
  }, [isSinglePaneRegion, resolveRange, visibleColumnIds]);

  return {
    merge,
    unmerge,
    toggleMerge,
    canMergeSelection,
    isSelectionExactlyMerged,
    getMergedCellAt: (row: number, col: number) =>
      getMergeLookupResult(mergedCells, mergedCellLookup, row, col),
  };
}
