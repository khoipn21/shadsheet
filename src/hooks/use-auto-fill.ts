import { useCallback, useRef, useState, useEffect } from "react";
import type { HyperFormula } from "hyperformula";
import type { CellAddress } from "@/types/spreadsheet-types";
import { letterToColIndex } from "@/utils/cell-address";

interface UseAutoFillParams {
  activeCell: CellAddress | null;
  selectionRange: { start: CellAddress; end: CellAddress } | null;
  visibleColumnIds: string[];
  totalRowCount: number;
  hf: HyperFormula | null;
  incrementRenderTrigger: () => void;
}

interface FillPreview {
  /** Target range end row (inclusive) */
  endRow: number;
  /** Target range end col index in visibleColumnIds */
  endColIdx: number;
}

/**
 * Auto-fill: drag handle on active cell/selection corner to fill pattern down/right.
 * Uses HyperFormula copy/paste for formula reference adjustment.
 */
export function useAutoFill({
  activeCell,
  selectionRange,
  visibleColumnIds,
  totalRowCount,
  hf,
  incrementRenderTrigger,
}: UseAutoFillParams) {
  const isDragging = useRef(false);
  const [fillPreview, setFillPreview] = useState<FillPreview | null>(null);

  /** Get the source range bounds */
  const getSourceBounds = useCallback(() => {
    if (selectionRange) {
      const { start, end } = selectionRange;
      const sc = visibleColumnIds.indexOf(start.columnId);
      const ec = visibleColumnIds.indexOf(end.columnId);
      return {
        minRow: Math.min(start.rowIndex, end.rowIndex),
        maxRow: Math.max(start.rowIndex, end.rowIndex),
        minCol: Math.min(sc, ec),
        maxCol: Math.max(sc, ec),
      };
    }
    if (activeCell) {
      const c = visibleColumnIds.indexOf(activeCell.columnId);
      return { minRow: activeCell.rowIndex, maxRow: activeCell.rowIndex, minCol: c, maxCol: c };
    }
    return null;
  }, [activeCell, selectionRange, visibleColumnIds]);

  const handleFillStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
  }, []);

  const handleFillMove = useCallback(
    (rowIndex: number, colIdx: number) => {
      if (!isDragging.current) return;
      const bounds = getSourceBounds();
      if (!bounds) return;
      // Only allow extending downward or rightward from the source range
      setFillPreview({
        endRow: Math.max(rowIndex, bounds.maxRow),
        endColIdx: Math.max(colIdx, bounds.maxCol),
      });
    },
    [getSourceBounds],
  );

  const handleFillEnd = useCallback(() => {
    if (!isDragging.current || !fillPreview || !hf) {
      isDragging.current = false;
      setFillPreview(null);
      return;
    }
    isDragging.current = false;

    const bounds = getSourceBounds();
    if (!bounds) {
      setFillPreview(null);
      return;
    }

    const srcWidth = bounds.maxCol - bounds.minCol + 1;
    const srcHeight = bounds.maxRow - bounds.minRow + 1;
    const srcColStart = letterToColIndex(visibleColumnIds[bounds.minCol]);

    // Use HF copy/paste for formula-aware fill
    hf.suspendEvaluation();

    hf.copy({
      start: { sheet: 0, row: bounds.minRow, col: srcColStart },
      end: { sheet: 0, row: bounds.minRow + srcHeight - 1, col: srcColStart + srcWidth - 1 },
    });

    // Fill downward: paste repeating source pattern
    if (fillPreview.endRow > bounds.maxRow) {
      for (let r = bounds.maxRow + 1; r <= Math.min(fillPreview.endRow, totalRowCount - 1); r += srcHeight) {
        const targetCol = letterToColIndex(visibleColumnIds[bounds.minCol]);
        hf.paste({ sheet: 0, row: r, col: targetCol });
      }
    }

    // Fill rightward: paste repeating source pattern
    if (fillPreview.endColIdx > bounds.maxCol) {
      for (let c = bounds.maxCol + 1; c <= Math.min(fillPreview.endColIdx, visibleColumnIds.length - 1); c += srcWidth) {
        const targetCol = letterToColIndex(visibleColumnIds[c]);
        hf.paste({ sheet: 0, row: bounds.minRow, col: targetCol });
      }
    }

    hf.resumeEvaluation();
    incrementRenderTrigger();
    setFillPreview(null);
  }, [fillPreview, hf, getSourceBounds, visibleColumnIds, totalRowCount, incrementRenderTrigger]);

  // Global mouseup listener — handles case where user drags outside browser window
  useEffect(() => {
    window.addEventListener("mouseup", handleFillEnd);
    return () => window.removeEventListener("mouseup", handleFillEnd);
  }, [handleFillEnd]);

  /** Position of fill handle: bottom-right of active cell/selection */
  const fillHandlePosition = getSourceBounds();

  return {
    fillHandlePosition,
    fillPreview,
    isDragging: isDragging.current,
    handleFillStart,
    handleFillMove,
    handleFillEnd,
  };
}
