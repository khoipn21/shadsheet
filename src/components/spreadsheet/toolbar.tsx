import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
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
import { exportToCSV, exportToXLSX } from "@/utils/export-utils";
import type { TextAlignment, SpreadsheetColumnConfig } from "@/types/spreadsheet-types";
import type { VisibilityState } from "@tanstack/react-table";
import { letterToColIndex, colIndexToLetter } from "@/utils/cell-address";

interface ToolbarProps {
  columns: SpreadsheetColumnConfig[];
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

export function Toolbar({ columns }: ToolbarProps) {
  const hf = useHyperFormula();
  const incrementRenderTrigger = useSpreadsheetStore((s) => s.incrementRenderTrigger);
  const columnVisibility = useSpreadsheetStore((s) => s.columnVisibility) as VisibilityState;
  const cellFormats = useSpreadsheetStore((s) => s.cellFormats);
  const toggleBold = useSpreadsheetStore((s) => s.toggleBold);
  const toggleItalic = useSpreadsheetStore((s) => s.toggleItalic);
  const setColor = useSpreadsheetStore((s) => s.setColor);
  const setBgColor = useSpreadsheetStore((s) => s.setBgColor);
  const setTextAlign = useSpreadsheetStore((s) => s.setTextAlign);
  const activeCell = useSpreadsheetStore((s) => s.activeCell);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const selectedKeys = useSelectedCellKeys();

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
    if (hf.isThereSomethingToUndo()) {
      hf.undo();
      incrementRenderTrigger();
    }
  }, [hf, incrementRenderTrigger]);

  const handleRedo = useCallback(() => {
    if (!hf) return;
    if (hf.isThereSomethingToRedo()) {
      hf.redo();
      incrementRenderTrigger();
    }
  }, [hf, incrementRenderTrigger]);

  const handleExportCSV = useCallback(() => {
    if (!hf) return;
    exportToCSV(hf, 0, columns, columnVisibility);
    setShowExportMenu(false);
  }, [hf, columns, columnVisibility]);

  const handleExportXLSX = useCallback(() => {
    if (!hf) return;
    exportToXLSX(hf, 0, columns, columnVisibility);
    setShowExportMenu(false);
  }, [hf, columns, columnVisibility]);

  const handleAlign = useCallback(
    (align: TextAlignment) => {
      if (selectedKeys.length > 0) setTextAlign(selectedKeys, align);
    },
    [selectedKeys, setTextAlign],
  );

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
