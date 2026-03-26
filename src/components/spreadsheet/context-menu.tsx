import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Scissors,
  Copy,
  ClipboardPaste,
  Combine,
  Plus,
  Trash2,
  ArrowUpAZ,
  ArrowDownAZ,
} from "lucide-react";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { useHyperFormula } from "@/hooks/use-hyperformula";
import { useClipboard } from "@/hooks/use-clipboard";
import { useMergeCells } from "@/hooks/use-merge-cells";
import type { CellValue, SpreadsheetTableMeta } from "@/types/spreadsheet-types";

interface ContextMenuProps {
  visibleColumnIds: string[];
  leftPinnedCount: number;
  centerCount: number;
  totalRowCount: number;
  meta?: SpreadsheetTableMeta;
  getCellValue: (rowIndex: number, columnId: string) => CellValue;
  canEditCell: (rowIndex: number, columnId: string) => boolean;
  onSort?: (columnId: string, desc: boolean) => void;
  onInsertRow?: (rowIndex: number, position: "above" | "below") => void;
  onDeleteRow?: (rowIndex: number) => void;
  onInsertColumn?: (colIndex: number, position: "left" | "right") => void;
  onDeleteColumn?: (colIndex: number) => void;
  className?: string;
}

export function ContextMenu({
  visibleColumnIds,
  leftPinnedCount,
  centerCount,
  totalRowCount,
  meta,
  getCellValue,
  canEditCell,
  onSort,
  onInsertRow,
  onDeleteRow,
  onInsertColumn,
  onDeleteColumn,
  className,
}: ContextMenuProps) {
  const contextMenu = useSpreadsheetStore((s) => s.contextMenu);
  const setContextMenu = useSpreadsheetStore((s) => s.setContextMenu);
  const activeCell = useSpreadsheetStore((s) => s.activeCell);
  const selectionRange = useSpreadsheetStore((s) => s.selectionRange);
  const hf = useHyperFormula();
  const incrementRenderTrigger = useSpreadsheetStore((s) => s.incrementRenderTrigger);
  const menuRef = useRef<HTMLDivElement>(null);
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
      meta?.updateData(rowIndex, columnId, value) !== false,
  });

  const { handleCopy, handleCut, handlePaste } = useClipboard({
    activeCell,
    selectionRange,
    visibleColumnIds,
    totalRowCount,
    meta,
    getCellValue,
    canEditCell,
    hf,
    incrementRenderTrigger,
  });

  const close = useCallback(() => setContextMenu(null), [setContextMenu]);

  // Close on click outside, escape, or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const handleScroll = () => close();

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu, close]);

  if (!contextMenu) return null;

  const { x, y, cell } = contextMenu;
  const colIdx = visibleColumnIds.indexOf(cell.columnId);
  const clickedMerge =
    colIdx !== -1 ? getMergedCellAt(cell.rowIndex, colIdx) : null;
  const mergeAtContext = clickedMerge;
  const showUnmerge = Boolean(mergeAtContext);
  const showMerge = !showUnmerge && canMergeSelection && !isSelectionExactlyMerged(selectionRange);

  // Clamp menu to viewport
  const menuWidth = 220;
  const menuHeight = 320;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

  const menuItem = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    shortcut?: string,
  ) => (
    <button
      type="button"
      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm text-left"
      onClick={() => { onClick(); close(); }}
    >
      <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-xs text-muted-foreground ml-auto">{shortcut}</span>}
    </button>
  );

  const separator = <div className="h-px bg-border my-1" />;

  return createPortal(
    <div
      ref={menuRef}
      className={`fixed z-50 min-w-[200px] bg-popover border border-border rounded-md shadow-md py-1 animate-in fade-in-0 zoom-in-95 ${className ?? ""}`}
      style={{ left: clampedX, top: clampedY }}
    >
      {menuItem("Cut", <Scissors className="w-3.5 h-3.5" />, handleCut, "Ctrl+X")}
      {menuItem("Copy", <Copy className="w-3.5 h-3.5" />, handleCopy, "Ctrl+C")}
      {menuItem("Paste", <ClipboardPaste className="w-3.5 h-3.5" />, handlePaste, "Ctrl+V")}
      {(showMerge || showUnmerge) && separator}
      {showMerge &&
        menuItem("Merge Cells", <Combine className="w-3.5 h-3.5" />, () => {
          toggleMerge(selectionRange);
        }, "Ctrl+M")}
      {showUnmerge &&
        menuItem("Unmerge Cells", <Combine className="w-3.5 h-3.5" />, () => {
          const merge = mergeAtContext?.merge;
          if (merge) {
            unmerge(merge.row, merge.col);
          }
        }, "Ctrl+M")}
      {separator}
      {menuItem("Insert Row Above", <Plus className="w-3.5 h-3.5" />, () => onInsertRow?.(cell.rowIndex, "above"))}
      {menuItem("Insert Row Below", <Plus className="w-3.5 h-3.5" />, () => onInsertRow?.(cell.rowIndex, "below"))}
      {menuItem("Insert Column Left", <Plus className="w-3.5 h-3.5" />, () => onInsertColumn?.(colIdx, "left"))}
      {menuItem("Insert Column Right", <Plus className="w-3.5 h-3.5" />, () => onInsertColumn?.(colIdx, "right"))}
      {separator}
      {menuItem("Delete Row", <Trash2 className="w-3.5 h-3.5" />, () => onDeleteRow?.(cell.rowIndex))}
      {menuItem("Delete Column", <Trash2 className="w-3.5 h-3.5" />, () => onDeleteColumn?.(colIdx))}
      {separator}
      {menuItem("Sort A → Z", <ArrowUpAZ className="w-3.5 h-3.5" />, () => onSort?.(cell.columnId, false))}
      {menuItem("Sort Z → A", <ArrowDownAZ className="w-3.5 h-3.5" />, () => onSort?.(cell.columnId, true))}
    </div>,
    document.body,
  );
}
