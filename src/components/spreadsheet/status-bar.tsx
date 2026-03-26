import { useMemo } from "react";
import type { HyperFormula } from "hyperformula";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { useHyperFormula } from "@/hooks/use-hyperformula";
import { letterToColIndex, toA1 } from "@/utils/cell-address";

interface StatusBarProps {
  totalRows: number;
  totalColumns: number;
  selectedRowCount: number;
  visibleColumnIds: string[];
}

/** Extract numeric values from a selection range via HyperFormula */
function getSelectionValues(
  hf: HyperFormula,
  startRow: number,
  endRow: number,
  startColId: string,
  endColId: string,
  visibleColumnIds: string[],
): number[] {
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const startIdx = visibleColumnIds.indexOf(startColId);
  const endIdx = visibleColumnIds.indexOf(endColId);
  if (startIdx === -1 || endIdx === -1) return [];
  const minCol = Math.min(startIdx, endIdx);
  const maxCol = Math.max(startIdx, endIdx);

  const nums: number[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const colId = visibleColumnIds[c];
      const col = letterToColIndex(colId);
      const val = hf.getCellValue({ sheet: 0, row: r, col });
      if (typeof val === "number" && !isNaN(val)) {
        nums.push(val);
      }
    }
  }
  return nums;
}

export function StatusBar({
  totalRows,
  totalColumns,
  selectedRowCount,
  visibleColumnIds,
}: StatusBarProps) {
  const hf = useHyperFormula();
  const activeCell = useSpreadsheetStore((s) => s.activeCell);
  const selectionRange = useSpreadsheetStore((s) => s.selectionRange);
  useSpreadsheetStore((s) => s.renderTrigger); // re-calc when HF changes

  // Active cell address label
  const cellLabel = activeCell
    ? toA1(activeCell.rowIndex, letterToColIndex(activeCell.columnId))
    : "";

  // Compute aggregates for selection range
  const aggregates = useMemo(() => {
    if (!hf || !selectionRange) return null;

    const { start, end } = selectionRange;
    const nums = getSelectionValues(
      hf,
      start.rowIndex,
      end.rowIndex,
      start.columnId,
      end.columnId,
      visibleColumnIds,
    );

    if (nums.length === 0) return null;

    const sum = nums.reduce((a, b) => a + b, 0);
    const count = nums.length;
    const avg = sum / count;
    const min = nums.reduce((a, b) => Math.min(a, b), Infinity);
    const max = nums.reduce((a, b) => Math.max(a, b), -Infinity);

    return { sum, count, avg, min, max };
  }, [hf, selectionRange, visibleColumnIds]);

  const fmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-1 text-xs text-muted-foreground bg-muted/30 gap-4">
      <div className="flex items-center gap-3">
        {cellLabel && (
          <span className="font-mono">{cellLabel}</span>
        )}
        <span>
          {totalRows.toLocaleString()} rows
          {selectedRowCount > 0 && ` (${selectedRowCount.toLocaleString()} selected)`}
        </span>
        <span>{totalColumns} columns</span>
      </div>

      {aggregates && (
        <div className="flex items-center gap-3 font-mono">
          <span>Sum: {fmt(aggregates.sum)}</span>
          <span>Avg: {fmt(aggregates.avg)}</span>
          <span>Count: {aggregates.count}</span>
          <span>Min: {fmt(aggregates.min)}</span>
          <span>Max: {fmt(aggregates.max)}</span>
        </div>
      )}
    </div>
  );
}
