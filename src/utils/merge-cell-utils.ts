import type {
  CellAddress,
  MergedCell,
  MergeLookupResult,
  SelectionRange,
} from "@/types/spreadsheet-types";

export interface SelectionBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export function mergeCellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function getMergeEndRow(merge: MergedCell): number {
  return merge.row + merge.rowSpan - 1;
}

export function getMergeEndCol(merge: MergedCell): number {
  return merge.col + merge.colSpan - 1;
}

export function buildMergeLookup(mergedCells: MergedCell[]): Map<string, number> {
  const lookup = new Map<string, number>();
  mergedCells.forEach((merge, mergeIndex) => {
    const endRow = getMergeEndRow(merge);
    const endCol = getMergeEndCol(merge);
    for (let row = merge.row; row <= endRow; row++) {
      for (let col = merge.col; col <= endCol; col++) {
        lookup.set(mergeCellKey(row, col), mergeIndex);
      }
    }
  });
  return lookup;
}

export function findMergeAt(
  lookup: Map<string, number>,
  row: number,
  col: number,
): number {
  return lookup.get(mergeCellKey(row, col)) ?? -1;
}

export function mergesOverlap(a: MergedCell, b: MergedCell): boolean {
  return !(
    getMergeEndRow(a) < b.row ||
    getMergeEndRow(b) < a.row ||
    getMergeEndCol(a) < b.col ||
    getMergeEndCol(b) < a.col
  );
}

export function mergeIntersectsRect(
  merge: MergedCell,
  minRow: number,
  maxRow: number,
  minCol: number,
  maxCol: number,
): boolean {
  return !(
    getMergeEndRow(merge) < minRow ||
    merge.row > maxRow ||
    getMergeEndCol(merge) < minCol ||
    merge.col > maxCol
  );
}

export function selectionRangeToBounds(
  range: SelectionRange,
  visibleColumnIds: string[],
): SelectionBounds | null {
  const startCol = visibleColumnIds.indexOf(range.start.columnId);
  const endCol = visibleColumnIds.indexOf(range.end.columnId);
  if (startCol === -1 || endCol === -1) return null;

  return {
    minRow: Math.min(range.start.rowIndex, range.end.rowIndex),
    maxRow: Math.max(range.start.rowIndex, range.end.rowIndex),
    minCol: Math.min(startCol, endCol),
    maxCol: Math.max(startCol, endCol),
  };
}

export function boundsToSelectionRange(
  bounds: SelectionBounds,
  visibleColumnIds: string[],
): SelectionRange | null {
  const startColumnId = visibleColumnIds[bounds.minCol];
  const endColumnId = visibleColumnIds[bounds.maxCol];
  if (!startColumnId || !endColumnId) return null;

  return {
    start: { rowIndex: bounds.minRow, columnId: startColumnId },
    end: { rowIndex: bounds.maxRow, columnId: endColumnId },
  };
}

export function selectionToMergeRegion(
  range: SelectionRange,
  visibleColumnIds: string[],
): MergedCell | null {
  const bounds = selectionRangeToBounds(range, visibleColumnIds);
  if (!bounds) return null;

  return {
    row: bounds.minRow,
    col: bounds.minCol,
    rowSpan: bounds.maxRow - bounds.minRow + 1,
    colSpan: bounds.maxCol - bounds.minCol + 1,
  };
}

export function findOverlappingMerges(
  mergedCells: MergedCell[],
  region: MergedCell,
): number[] {
  const overlaps: number[] = [];
  mergedCells.forEach((merge, index) => {
    if (mergesOverlap(merge, region)) {
      overlaps.push(index);
    }
  });
  return overlaps;
}

export function findMergesIntersectingBounds(
  mergedCells: MergedCell[],
  bounds: SelectionBounds,
): MergedCell[] {
  return mergedCells.filter((merge) =>
    mergeIntersectsRect(
      merge,
      bounds.minRow,
      bounds.maxRow,
      bounds.minCol,
      bounds.maxCol,
    ),
  );
}

export function getMergeLookupResult(
  mergedCells: MergedCell[],
  lookup: Map<string, number>,
  row: number,
  col: number,
): MergeLookupResult | null {
  const mergeIndex = findMergeAt(lookup, row, col);
  if (mergeIndex === -1) return null;
  const merge = mergedCells[mergeIndex];
  if (!merge) return null;
  return {
    merge,
    isAnchor: merge.row === row && merge.col === col,
  };
}

export function snapCellToMergeAnchor(
  cell: CellAddress,
  visibleColumnIds: string[],
  mergedCells: MergedCell[],
  lookup: Map<string, number>,
): CellAddress {
  const colIndex = visibleColumnIds.indexOf(cell.columnId);
  if (colIndex === -1) return cell;

  const mergeLookup = getMergeLookupResult(
    mergedCells,
    lookup,
    cell.rowIndex,
    colIndex,
  );
  if (!mergeLookup) return cell;

  return {
    rowIndex: mergeLookup.merge.row,
    columnId: visibleColumnIds[mergeLookup.merge.col] ?? cell.columnId,
  };
}

export function expandSelectionForMerges(
  range: SelectionRange,
  visibleColumnIds: string[],
  mergedCells: MergedCell[],
  maxIterations = 3,
): SelectionRange {
  let bounds = selectionRangeToBounds(range, visibleColumnIds);
  if (!bounds) return range;

  for (let i = 0; i < maxIterations; i++) {
    let changed = false;
    for (const merge of mergedCells) {
      if (
        mergeIntersectsRect(
          merge,
          bounds.minRow,
          bounds.maxRow,
          bounds.minCol,
          bounds.maxCol,
        )
      ) {
        const nextBounds: SelectionBounds = {
          minRow: Math.min(bounds.minRow, merge.row),
          maxRow: Math.max(bounds.maxRow, getMergeEndRow(merge)),
          minCol: Math.min(bounds.minCol, merge.col),
          maxCol: Math.max(bounds.maxCol, getMergeEndCol(merge)),
        };
        if (
          nextBounds.minRow !== bounds.minRow ||
          nextBounds.maxRow !== bounds.maxRow ||
          nextBounds.minCol !== bounds.minCol ||
          nextBounds.maxCol !== bounds.maxCol
        ) {
          bounds = nextBounds;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return boundsToSelectionRange(bounds, visibleColumnIds) ?? range;
}
