import { useCallback } from "react";
import { useHyperFormula } from "./use-hyperformula";
import { useSpreadsheetStore } from "./use-spreadsheet-store";

/**
 * Hook providing insert/delete row/column operations via HyperFormula.
 * All operations are undoable through HF's built-in undo stack.
 */
export function useGridOperations() {
  const hf = useHyperFormula();
  const incrementRenderTrigger = useSpreadsheetStore((s) => s.incrementRenderTrigger);
  const columns = useSpreadsheetStore((s) => s.columns);
  const setColumns = useSpreadsheetStore((s) => s.setColumns);
  const shiftCellFormatKeys = useSpreadsheetStore((s) => s.shiftCellFormatKeys);
  const removeCellFormatRow = useSpreadsheetStore((s) => s.removeCellFormatRow);
  const shiftMergedCells = useSpreadsheetStore((s) => s.shiftMergedCells);

  const insertRow = useCallback(
    (rowIndex: number, position: "above" | "below") => {
      if (!hf) return;
      const targetRow = position === "below" ? rowIndex + 1 : rowIndex;
      hf.addRows(0, [targetRow, 1]);
      // Shift cell format keys for rows >= targetRow
      shiftCellFormatKeys(targetRow, "up");
      shiftMergedCells("row", targetRow, "insert");
      incrementRenderTrigger();
    },
    [hf, incrementRenderTrigger, shiftCellFormatKeys, shiftMergedCells],
  );

  const deleteRow = useCallback(
    (rowIndex: number) => {
      if (!hf) return;
      hf.removeRows(0, [rowIndex, 1]);
      // Remove deleted row's formats and shift remaining keys down
      removeCellFormatRow(rowIndex);
      shiftMergedCells("row", rowIndex, "delete");
      incrementRenderTrigger();
    },
    [hf, incrementRenderTrigger, removeCellFormatRow, shiftMergedCells],
  );

  const insertColumn = useCallback(
    (colIndex: number, position: "left" | "right") => {
      if (!hf) return;
      const targetCol = position === "right" ? colIndex + 1 : colIndex;
      hf.addColumns(0, [targetCol, 1]);
      // Update column configs — insert a placeholder column config
      const newCol = {
        id: `col_${Date.now()}`,
        header: `Col ${columns.length + 1}`,
        editable: true,
        type: "text" as const,
      };
      const updated = [...columns];
      updated.splice(targetCol, 0, newCol);
      setColumns(updated);
      shiftMergedCells("col", targetCol, "insert");
      incrementRenderTrigger();
    },
    [hf, columns, setColumns, incrementRenderTrigger, shiftMergedCells],
  );

  const deleteColumn = useCallback(
    (colIndex: number) => {
      if (!hf) return;
      hf.removeColumns(0, [colIndex, 1]);
      // Remove from column configs
      const updated = columns.filter((_, i) => i !== colIndex);
      setColumns(updated);
      shiftMergedCells("col", colIndex, "delete");
      incrementRenderTrigger();
    },
    [hf, columns, setColumns, incrementRenderTrigger, shiftMergedCells],
  );

  return { insertRow, deleteRow, insertColumn, deleteColumn };
}
