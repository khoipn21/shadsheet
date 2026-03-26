import type { MergedCell } from "@/types/spreadsheet-types";

export interface MergeInterval {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  mergeIndex: number;
}

export function buildMergeIntervals(mergedCells: MergedCell[]): MergeInterval[] {
  return mergedCells
    .map((merge, mergeIndex) => ({
      startRow: merge.row,
      endRow: merge.row + merge.rowSpan - 1,
      startCol: merge.col,
      endCol: merge.col + merge.colSpan - 1,
      mergeIndex,
    }))
    .sort(
      (a, b) =>
        a.startRow - b.startRow ||
        a.endRow - b.endRow ||
        a.startCol - b.startCol ||
        a.endCol - b.endCol,
    );
}

function findFirstPotentialRowIndex(
  intervals: MergeInterval[],
  rowStart: number,
): number {
  let low = 0;
  let high = intervals.length - 1;
  let answer = intervals.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (intervals[mid].endRow >= rowStart) {
      answer = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return answer;
}

export function findVisibleMerges(
  intervals: MergeInterval[],
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
): number[] {
  if (intervals.length === 0 || rowEnd < rowStart || colEnd < colStart) {
    return [];
  }

  const mergeIndices = new Set<number>();
  const startIndex = findFirstPotentialRowIndex(intervals, rowStart);

  for (let i = startIndex; i < intervals.length; i++) {
    const interval = intervals[i];
    if (interval.startRow > rowEnd) break;
    if (interval.endCol < colStart || interval.startCol > colEnd) continue;
    mergeIndices.add(interval.mergeIndex);
  }

  return [...mergeIndices];
}
