import { useState, useCallback, useEffect, useRef, useContext } from "react";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { useHyperFormula } from "@/hooks/use-hyperformula";
import { getCellRawValue } from "@/utils/formula-utils";
import { toA1, letterToColIndex } from "@/utils/cell-address";
import { TableContext } from "./spreadsheet-provider";
import type { SpreadsheetTableMeta } from "@/types/spreadsheet-types";
import { FormulaReferenceInput } from "./formula-reference-input";

interface FormulaBarProps {
  className?: string;
}

/**
 * Formula bar: shows cell address label + raw formula/value of active cell.
 * Editing the formula bar commits through HyperFormula.
 */
export function FormulaBar({ className }: FormulaBarProps) {
  const hf = useHyperFormula();
  const table = useContext(TableContext);
  const activeCell = useSpreadsheetStore((s) => s.activeCell);
  const editingCell = useSpreadsheetStore((s) => s.editingCell);
  const setFormulaPreviewValue = useSpreadsheetStore(
    (s) => s.setFormulaPreviewValue,
  );
  const incrementRenderTrigger = useSpreadsheetStore((s) => s.incrementRenderTrigger);
  useSpreadsheetStore((s) => s.renderTrigger);
  const meta = table?.options.meta as SpreadsheetTableMeta | undefined;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");
  const currentRow = activeCell ? table?.getRowModel().rows[activeCell.rowIndex]?.original : undefined;
  const canEdit =
    Boolean(activeCell) &&
    meta?.featureFlags.editable !== false &&
    (activeCell && currentRow
      ? (meta?.featureFlags.onBeforeCellEdit?.(activeCell, currentRow) ?? true)
      : true);

  // Derive cell address label and raw value
  const cellLabel = activeCell
    ? toA1(activeCell.rowIndex, letterToColIndex(activeCell.columnId))
    : "";

  const rawValue =
    hf && activeCell
      ? getCellRawValue(hf, activeCell.rowIndex, letterToColIndex(activeCell.columnId))
      : "";

  // Sync local value when active cell changes (or after HF recalc)
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(rawValue);
    }
  }, [rawValue, isEditing]);

  const handleFocus = useCallback(() => {
    if (!canEdit) return;
    setIsEditing(true);
    setLocalValue(rawValue);
    setFormulaPreviewValue(rawValue);
  }, [canEdit, rawValue, setFormulaPreviewValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    setLocalValue(nextValue);
    setFormulaPreviewValue(nextValue);
  }, [setFormulaPreviewValue]);

  const commit = useCallback(() => {
    if (!hf || !activeCell || !canEdit) return;
    if (meta?.updateData(activeCell.rowIndex, activeCell.columnId, localValue) === false) {
      return;
    }
    const col = letterToColIndex(activeCell.columnId);
    hf.setCellContents({ sheet: 0, row: activeCell.rowIndex, col }, [[localValue]]);
    incrementRenderTrigger();
    setIsEditing(false);
    setFormulaPreviewValue(null);
  }, [hf, activeCell, canEdit, localValue, incrementRenderTrigger, meta, setFormulaPreviewValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        inputRef.current?.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setLocalValue(rawValue);
        setFormulaPreviewValue(null);
        setIsEditing(false);
        inputRef.current?.blur();
      }
    },
    [commit, rawValue, setFormulaPreviewValue],
  );

  const handleBlur = useCallback(() => {
    if (isEditing) {
      commit();
      return;
    }
    setFormulaPreviewValue(null);
  }, [isEditing, commit, setFormulaPreviewValue]);

  useEffect(() => () => setFormulaPreviewValue(null), [setFormulaPreviewValue]);

  // Don't render formula bar while a cell editor is active (avoid double editing UX)
  const isCellEditing = editingCell !== null;

  return (
    <div className={`flex items-center gap-2 border border-border rounded-md bg-background px-2 h-8 text-sm ${className ?? ""}`}>
      {/* Cell address label */}
      <span className="font-mono text-muted-foreground w-12 text-center flex-shrink-0 select-none">
        {cellLabel}
      </span>
      <div className="w-px h-4 bg-border flex-shrink-0" />
      {/* Formula/value input */}
      <span className="text-muted-foreground flex-shrink-0 select-none text-xs italic">fx</span>
      <FormulaReferenceInput
        ref={inputRef}
        type="text"
        className="flex-1 min-w-0 h-full"
        contentClassName="flex h-full items-center font-mono text-sm min-w-0"
        inputClassName="w-full h-full placeholder:text-muted-foreground"
        value={isCellEditing ? rawValue : localValue}
        readOnly={isCellEditing || !activeCell || !canEdit}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={activeCell ? "" : "Select a cell"}
      />
    </div>
  );
}
