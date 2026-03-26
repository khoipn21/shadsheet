import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Combine,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Download,
  Palette,
  Paintbrush,
} from "lucide-react";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { useHyperFormula } from "@/hooks/use-hyperformula";
import { useMergeCells } from "@/hooks/use-merge-cells";
import { exportToCSV, exportToXLSX } from "@/utils/export-utils";
import { didUndoRedoTouchMergeHistoryMarker } from "@/utils/formula-utils";
import type {
  SpreadsheetColumnConfig,
  SpreadsheetExportFormat,
  SpreadsheetTableMeta,
  TextAlignment,
} from "@/types/spreadsheet-types";
import type { VisibilityState } from "@tanstack/react-table";
import { letterToColIndex, colIndexToLetter } from "@/utils/cell-address";
import { TableContext } from "./spreadsheet-provider";

interface ToolbarProps {
  columns: SpreadsheetColumnConfig[];
  exportFileName?: string;
  onExport?: (format: SpreadsheetExportFormat) => void;
}

function getExportFileName(baseName: string | undefined, format: SpreadsheetExportFormat) {
  const sanitizedBase = (baseName ?? "spreadsheet").replace(/\.(csv|xlsx)$/i, "");
  return `${sanitizedBase}.${format}`;
}

/** Build cell format keys ("row-col") for all cells in current selection */
function useSelectedCellKeys(): string[] {
  const activeCell = useSpreadsheetStore((s) => s.activeCell);
  const selectionRange = useSpreadsheetStore((s) => s.selectionRange);

  if (selectionRange) {
    const { start, end } = selectionRange;
    const minRow = Math.min(start.rowIndex, end.rowIndex);
    const maxRow = Math.max(start.rowIndex, end.rowIndex);
    const startCol = letterToColIndex(start.columnId);
    const endCol = letterToColIndex(end.columnId);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const keys: string[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        keys.push(`${r}-${colIndexToLetter(c)}`);
      }
    }
    return keys;
  }

  if (activeCell) {
    return [`${activeCell.rowIndex}-${activeCell.columnId}`];
  }

  return [];
}

export function Toolbar({ columns, exportFileName, onExport }: ToolbarProps) {
  const table = useContext(TableContext);
  const tableMeta = table?.options.meta as SpreadsheetTableMeta | undefined;
  const hf = useHyperFormula();
  const incrementRenderTrigger = useSpreadsheetStore((s) => s.incrementRenderTrigger);
  const undoMergeHistory = useSpreadsheetStore((s) => s.undoMergeHistory);
  const redoMergeHistory = useSpreadsheetStore((s) => s.redoMergeHistory);
  const columnVisibility = useSpreadsheetStore((s) => s.columnVisibility) as VisibilityState;
  const cellFormats = useSpreadsheetStore((s) => s.cellFormats);
  const mergedCells = useSpreadsheetStore((s) => s.mergedCells);
  const mergedCellLookup = useSpreadsheetStore((s) => s.mergedCellLookup);
  const toggleBold = useSpreadsheetStore((s) => s.toggleBold);
  const toggleItalic = useSpreadsheetStore((s) => s.toggleItalic);
  const setColor = useSpreadsheetStore((s) => s.setColor);
  const setBgColor = useSpreadsheetStore((s) => s.setBgColor);
  const setTextAlign = useSpreadsheetStore((s) => s.setTextAlign);
  const activeCell = useSpreadsheetStore((s) => s.activeCell);
  const selectionRange = useSpreadsheetStore((s) => s.selectionRange);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const selectedKeys = useSelectedCellKeys();

  const visibleColumnIds = useMemo(() => {
    if (!table) return columns.map((column) => String(column.id));
    return table
      .getVisibleLeafColumns()
      .map((column) => column.id)
      .filter((id) => id !== "_row_number");
  }, [columns, table]);

  const leftPinnedCount = useMemo(() => {
    if (!table) return 0;
    return table
      .getLeftVisibleLeafColumns()
      .filter((column) => column.id !== "_row_number").length;
  }, [table]);

  const centerCount = useMemo(() => {
    if (!table) return visibleColumnIds.length;
    return table
      .getCenterVisibleLeafColumns()
      .filter((column) => column.id !== "_row_number").length;
  }, [table, visibleColumnIds.length]);

  const {
    toggleMerge,
    unmerge,
    canMergeSelection,
    isSelectionExactlyMerged,
    getMergedCellAt,
  } = useMergeCells({
    visibleColumnIds,
    leftPinnedCount,
    centerCount,
    onClearCellValue: (rowIndex, columnId, value) =>
      tableMeta?.updateData(rowIndex, columnId, value) !== false,
  });

  const activeMerge = useMemo(() => {
    if (!activeCell) return null;
    const colIndex = visibleColumnIds.indexOf(activeCell.columnId);
    if (colIndex === -1) return null;
    return getMergedCellAt(activeCell.rowIndex, colIndex);
  }, [activeCell, getMergedCellAt, visibleColumnIds]);

  const mergeActive = isSelectionExactlyMerged(selectionRange) || Boolean(activeMerge);
  const canToggleMerge = canMergeSelection || Boolean(activeMerge);

  // Close export menu on click outside
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  // Check active cell format for button active states
  const activeCellKey = activeCell ? `${activeCell.rowIndex}-${activeCell.columnId}` : "";
  const activeFormat = cellFormats[activeCellKey];
  const isBold = activeFormat?.bold ?? false;
  const isItalic = activeFormat?.italic ?? false;
  const currentAlign = activeFormat?.align ?? "left";

  const handleUndo = useCallback(() => {
    if (!hf) return;
    if (!hf.isThereSomethingToUndo()) return;
    try {
      const changes = hf.undo();
      if (didUndoRedoTouchMergeHistoryMarker(hf, changes)) {
        undoMergeHistory?.();
      }
      incrementRenderTrigger();
      tableMeta?.syncFromFormulaEngine?.();
    } catch (error) {
      console.error("Undo failed:", error);
    }
  }, [hf, incrementRenderTrigger, tableMeta, undoMergeHistory]);

  const handleRedo = useCallback(() => {
    if (!hf) return;
    if (!hf.isThereSomethingToRedo()) return;
    try {
      const changes = hf.redo();
      if (didUndoRedoTouchMergeHistoryMarker(hf, changes)) {
        redoMergeHistory?.();
      }
      incrementRenderTrigger();
      tableMeta?.syncFromFormulaEngine?.();
    } catch (error) {
      console.error("Redo failed:", error);
    }
  }, [hf, incrementRenderTrigger, redoMergeHistory, tableMeta]);

  const handleExportCSV = useCallback(() => {
    if (!hf) return;
    exportToCSV(
      hf,
      0,
      columns,
      columnVisibility,
      getExportFileName(exportFileName, "csv"),
      { mergedCells, mergedCellLookup },
      visibleColumnIds,
    );
    onExport?.("csv");
    setShowExportMenu(false);
    }, [hf, columns, columnVisibility, exportFileName, onExport, mergedCells, mergedCellLookup, visibleColumnIds]);

  const handleExportXLSX = useCallback(() => {
    if (!hf) return;
    void exportToXLSX(
      hf,
      0,
      columns,
      columnVisibility,
      getExportFileName(exportFileName, "xlsx"),
      { mergedCells, mergedCellLookup },
      visibleColumnIds,
    );
    onExport?.("xlsx");
    setShowExportMenu(false);
  }, [hf, columns, columnVisibility, exportFileName, onExport, mergedCells, mergedCellLookup, visibleColumnIds]);

  const handleAlign = useCallback(
    (align: TextAlignment) => {
      if (selectedKeys.length > 0) setTextAlign(selectedKeys, align);
    },
    [selectedKeys, setTextAlign],
  );

  const handleToggleMerge = useCallback(() => {
    if (activeMerge && !isSelectionExactlyMerged(selectionRange)) {
      unmerge(activeMerge.merge.row, activeMerge.merge.col);
      return;
    }
    toggleMerge(selectionRange);
  }, [activeMerge, isSelectionExactlyMerged, selectionRange, toggleMerge, unmerge]);

  const toolbarBtn = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    active = false,
    disabled = false,
  ) => (
    <button
      type="button"
      title={label}
      disabled={disabled}
      className={`p-1.5 rounded-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      }`}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  const separator = <div className="w-px h-5 bg-border mx-1" />;

  return (
    <div className="flex items-center gap-0.5 border border-border rounded-md bg-background px-2 h-9 text-sm">
      {/* Undo / Redo */}
      {toolbarBtn("Undo", <Undo2 className="w-4 h-4" />, handleUndo, false, !hf?.isThereSomethingToUndo())}
      {toolbarBtn("Redo", <Redo2 className="w-4 h-4" />, handleRedo, false, !hf?.isThereSomethingToRedo())}
      {separator}

      {/* Text formatting */}
      {toolbarBtn("Bold", <Bold className="w-4 h-4" />, () => toggleBold(selectedKeys), isBold, selectedKeys.length === 0)}
      {toolbarBtn("Italic", <Italic className="w-4 h-4" />, () => toggleItalic(selectedKeys), isItalic, selectedKeys.length === 0)}
      {toolbarBtn("Merge Cells (Ctrl+M)", <Combine className="w-4 h-4" />, handleToggleMerge, mergeActive, !canToggleMerge)}
      {separator}

      {/* Text color */}
      <label title="Text Color" className="relative p-1.5 rounded-sm hover:bg-accent text-muted-foreground cursor-pointer">
        <Palette className="w-4 h-4" />
        <input
          type="color"
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          defaultValue={activeFormat?.color ?? "#000000"}
          onChange={(e) => setColor(selectedKeys, e.target.value)}
        />
      </label>

      {/* Background color */}
      <label title="Background Color" className="relative p-1.5 rounded-sm hover:bg-accent text-muted-foreground cursor-pointer">
        <Paintbrush className="w-4 h-4" />
        <input
          type="color"
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          defaultValue={activeFormat?.bgColor ?? "#ffffff"}
          onChange={(e) => setBgColor(selectedKeys, e.target.value)}
        />
      </label>
      {separator}

      {/* Alignment */}
      {toolbarBtn("Align Left", <AlignLeft className="w-4 h-4" />, () => handleAlign("left"), currentAlign === "left", selectedKeys.length === 0)}
      {toolbarBtn("Align Center", <AlignCenter className="w-4 h-4" />, () => handleAlign("center"), currentAlign === "center", selectedKeys.length === 0)}
      {toolbarBtn("Align Right", <AlignRight className="w-4 h-4" />, () => handleAlign("right"), currentAlign === "right", selectedKeys.length === 0)}
      {separator}

      {/* Export dropdown */}
      <div className="relative" ref={exportMenuRef}>
        {toolbarBtn("Export", <Download className="w-4 h-4" />, () => setShowExportMenu(!showExportMenu))}
        {showExportMenu && (
          <div className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[140px]">
            <button
              type="button"
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground"
              onClick={handleExportCSV}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground"
              onClick={handleExportXLSX}
            >
              Export XLSX
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
