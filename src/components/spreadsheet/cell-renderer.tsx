import { memo, useCallback, useRef } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { flexRender, type Cell } from "@tanstack/react-table";
import type {
  CellValue,
  CellFormat,
  ClipboardSelectionMode,
  ConditionalFormatRule,
  SpreadsheetTableMeta,
} from "@/types/spreadsheet-types";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { useHyperFormula } from "@/hooks/use-hyperformula";
import { validateCellValue, isCellEditable } from "@/utils/validation-utils";
import { getCellDisplayValue, getCellRawValue, isFormulaError } from "@/utils/formula-utils";
import { letterToColIndex } from "@/utils/cell-address";
import { CellEditorSwitch } from "./cell-editor-switch";

const TREE_INDENT_PX = 20;

interface CellOutline {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

interface CellRendererProps {
  cell: Cell<Record<string, CellValue>, unknown>;
  width: number;
  height: number;
  translateX: number;
  isActive?: boolean;
  isSelected?: boolean;
  rowSelected?: boolean;
  rowExpanded?: boolean;
  formulaReferenceColor?: string;
  onCellMouseDown?: (rowIndex: number, columnId: string, shiftKey: boolean) => void;
  onCellMouseEnter?: (rowIndex: number, columnId: string) => void;
  /** Called after successful commit with a navigation direction (Enter/Tab) */
  onNavigate?: (fromRow: number, fromColumnId: string, direction: "up" | "down" | "left" | "right") => void;
  /** Conditional formatting rules evaluated per-cell */
  conditionalFormats?: ConditionalFormatRule[];
  selectionOutline?: CellOutline | null;
  clipboardOutline?: CellOutline | null;
  clipboardMode?: ClipboardSelectionMode | null;
}

function renderSolidOutline(outline: CellOutline, color: string, zIndex: number) {
  return (
    <>
      {outline.top && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-0.5" style={{ backgroundColor: color, zIndex }} />
      )}
      {outline.bottom && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: color, zIndex }} />
      )}
      {outline.left && (
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-0.5" style={{ backgroundColor: color, zIndex }} />
      )}
      {outline.right && (
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-0.5" style={{ backgroundColor: color, zIndex }} />
      )}
    </>
  );
}

function renderClipboardOutline(outline: CellOutline, mode: ClipboardSelectionMode) {
  const borderColor = "var(--primary)";
  const opacity = mode === "cut" ? 0.7 : 0.95;
  // Clockwise marching ants: top→right, right→down, bottom→left(reverse), left→up(reverse)
  return (
    <>
      {outline.top && (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 h-0.5"
          style={{
            zIndex: 6,
            opacity,
            backgroundImage: `repeating-linear-gradient(90deg, ${borderColor} 0 6px, transparent 6px 10px)`,
            animation: "spreadsheet-marquee-x 0.6s linear infinite",
          }}
        />
      )}
      {outline.bottom && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-0.5"
          style={{
            zIndex: 6,
            opacity,
            backgroundImage: `repeating-linear-gradient(90deg, ${borderColor} 0 6px, transparent 6px 10px)`,
            animation: "spreadsheet-marquee-x 0.6s linear infinite reverse",
          }}
        />
      )}
      {outline.left && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 top-0 w-0.5"
          style={{
            zIndex: 6,
            opacity,
            backgroundImage: `repeating-linear-gradient(180deg, ${borderColor} 0 6px, transparent 6px 10px)`,
            animation: "spreadsheet-marquee-y 0.6s linear infinite reverse",
          }}
        />
      )}
      {outline.right && (
        <div
          className="pointer-events-none absolute bottom-0 right-0 top-0 w-0.5"
          style={{
            zIndex: 6,
            opacity,
            backgroundImage: `repeating-linear-gradient(180deg, ${borderColor} 0 6px, transparent 6px 10px)`,
            animation: "spreadsheet-marquee-y 0.6s linear infinite",
          }}
        />
      )}
    </>
  );
}

export const CellRenderer = memo(function CellRenderer({
  cell,
  width,
  height,
  translateX,
  isActive = false,
  isSelected = false,
  rowSelected,
  rowExpanded,
  formulaReferenceColor,
  onCellMouseDown,
  onCellMouseEnter,
  onNavigate,
  conditionalFormats,
  selectionOutline,
  clipboardOutline,
  clipboardMode,
}: CellRendererProps) {
  const commitRef = useRef(false);
  const navDirectionRef = useRef<"up" | "down" | "left" | "right" | null>(null);
  const columnId = cell.column.id;
  const rowIndex = cell.row.index;
  const isRowNumberCol = columnId === "_row_number";

  // HyperFormula integration — read values from HF when available
  const hf = useHyperFormula();
  // Subscribe to renderTrigger so we re-render when HF data changes
  useSpreadsheetStore((s) => s.renderTrigger);

  const hfCol = isRowNumberCol ? -1 : letterToColIndex(columnId);

  // Read value: from HyperFormula if available, fallback to TanStack
  const fallbackValue = cell.getValue() as CellValue;
  const value = hf && !isRowNumberCol ? getCellDisplayValue(hf, rowIndex, hfCol) : fallbackValue;
  const displayValue = value == null ? "" : String(value);
  const hasFormulaError = isFormulaError(value);

  const row = cell.row;
  const depth = row.depth;
  const canExpand = row.getCanExpand();
  const currentRowSelected = rowSelected ?? row.getIsSelected();
  const isExpanded = rowExpanded ?? row.getIsExpanded();
  const toggleExpanded = row.getToggleExpandedHandler();
  const firstVisibleDataCell = row
    .getVisibleCells()
    .find((visibleCell) => visibleCell.column.id !== "_row_number");

  // Store selectors
  const editingCell = useSpreadsheetStore((s) => s.editingCell);
  const editValue = useSpreadsheetStore((s) => s.editValue);
  const validationError = useSpreadsheetStore((s) => s.validationError);
  const startEditing = useSpreadsheetStore((s) => s.startEditing);
  const cancelEdit = useSpreadsheetStore((s) => s.cancelEdit);
  const setEditValue = useSpreadsheetStore((s) => s.setEditValue);
  const setValidationError = useSpreadsheetStore((s) => s.setValidationError);
  const setEditingCell = useSpreadsheetStore((s) => s.setEditingCell);
  const incrementRenderTrigger = useSpreadsheetStore((s) => s.incrementRenderTrigger);

  const meta = cell.getContext().table.options.meta as SpreadsheetTableMeta | undefined;
  const columnConfig = meta?.getColumnConfig(columnId);

  // Cell formatting (Phase 7) — read manual format from store
  const formatKey = `${rowIndex}-${columnId}`;
  const manualFormat = useSpreadsheetStore((s) => s.cellFormats[formatKey]) as CellFormat | undefined;

  const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnId === columnId;
  const editable =
    meta?.featureFlags.editable !== false &&
    (meta?.featureFlags.onBeforeCellEdit?.({ rowIndex, columnId }, row.original) ?? true) &&
    isCellEditable(columnConfig, row.original);

  // Show tree controls only in the first data column (skip _row_number)
  const isFirstDataCol = !isRowNumberCol && columnId === firstVisibleDataCell?.column.id;
  const showTreeControls = (isFirstDataCol && depth > 0) || (isFirstDataCol && canExpand);
  const indentPx = isFirstDataCol ? depth * TREE_INDENT_PX : 0;

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  const handleChevronMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleExpanded();
    },
    [toggleExpanded],
  );

  const handleChevronKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      toggleExpanded();
    },
    [toggleExpanded],
  );

  const handleDoubleClick = useCallback(() => {
    if (!editable || isRowNumberCol) return;
    startEditing({ rowIndex, columnId });
  }, [editable, isRowNumberCol, startEditing, rowIndex, columnId]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isRowNumberCol) return;
      if ((e.target as HTMLElement).closest("button,input,select,textarea,label")) return;
      onCellMouseDown?.(rowIndex, columnId, e.shiftKey);
    },
    [isRowNumberCol, onCellMouseDown, rowIndex, columnId],
  );

  const handleMouseEnter = useCallback(() => {
    if (isRowNumberCol) return;
    onCellMouseEnter?.(rowIndex, columnId);
  }, [isRowNumberCol, onCellMouseEnter, rowIndex, columnId]);

  const handleEditorChange = useCallback(
    (newValue: CellValue) => {
      setEditValue(newValue);
      setValidationError(null);
    },
    [setEditValue, setValidationError],
  );

  const handleBooleanToggle = useCallback(
    (nextValue: boolean) => {
      if (!editable || isRowNumberCol) return;

      const accepted = meta?.updateData(rowIndex, columnId, nextValue) ?? true;
      if (!accepted) return;

      if (hf) {
        hf.setCellContents({ sheet: 0, row: rowIndex, col: hfCol }, [[nextValue]]);
        incrementRenderTrigger();
      }
    },
    [editable, isRowNumberCol, meta, rowIndex, columnId, hf, hfCol, incrementRenderTrigger],
  );

  const handleCommit = useCallback(() => {
    if (commitRef.current) return;
    commitRef.current = true;

    const finalValue = editValue === null ? value : editValue;

    if (columnConfig) {
      const result = validateCellValue(finalValue, columnConfig);
      if (!result.success) {
        setValidationError(result.error ?? "Invalid");
        commitRef.current = false;
        navDirectionRef.current = null;
        return;
      }
    }

    const accepted = meta?.updateData(rowIndex, columnId, finalValue) ?? true;
    if (!accepted) {
      commitRef.current = false;
      navDirectionRef.current = null;
      return;
    }

    // Route through HyperFormula if available
    if (hf && !isRowNumberCol) {
      hf.setCellContents({ sheet: 0, row: rowIndex, col: hfCol }, [[finalValue]]);
      incrementRenderTrigger();
    }

    setEditingCell(null);
    setEditValue(null);
    setValidationError(null);

    const dir = navDirectionRef.current;
    navDirectionRef.current = null;
    if (dir && onNavigate) {
      onNavigate(rowIndex, columnId, dir);
    }

    queueMicrotask(() => { commitRef.current = false; });
  }, [editValue, value, columnConfig, hf, isRowNumberCol, hfCol, rowIndex, meta, columnId, setEditingCell, setEditValue, setValidationError, incrementRenderTrigger, onNavigate]);

  const handleCancel = useCallback(() => {
    navDirectionRef.current = null;
    cancelEdit();
  }, [cancelEdit]);

  const handleEditorKeyCapture = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      navDirectionRef.current = e.shiftKey ? "up" : "down";
    } else if (e.key === "Tab") {
      navDirectionRef.current = e.shiftKey ? "left" : "right";
    } else if (e.key === "Escape") {
      navDirectionRef.current = null;
    }
  }, []);

  const isGrouped = cell.getIsGrouped();
  const isAggregated = cell.getIsAggregated();
  const hasError = isEditing && validationError;

  if (isEditing && columnConfig) {
    // When editing, show raw formula from HF (e.g. "=SUM(A1:A10)") rather than computed value
    const rawValue = hf && !isRowNumberCol ? getCellRawValue(hf, rowIndex, hfCol) : value;
    const currentValue = editValue === null ? rawValue : editValue;
    return (
      <div
        role="gridcell"
        data-col-id={columnId}
        className="absolute top-0 left-0"
        style={{
          width,
          height,
          transform: `translateX(${translateX}px)`,
        }}
        onKeyDownCapture={handleEditorKeyCapture}
      >
        <CellEditorSwitch
          value={currentValue}
          onChange={handleEditorChange}
          onCommit={handleCommit}
          onCancel={handleCancel}
          columnConfig={columnConfig}
        />
        {hasError && (
          <div className="absolute left-0 top-full z-50 bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-b shadow-md max-w-[200px] truncate">
            {validationError}
          </div>
        )}
      </div>
    );
  }

  // Merge manual format with conditional format rules
  let mergedFormat: CellFormat = manualFormat ? { ...manualFormat } : {};
  if (conditionalFormats && !isRowNumberCol) {
    for (const rule of conditionalFormats) {
      const { start, end } = rule.range;
      const minRow = Math.min(start.rowIndex, end.rowIndex);
      const maxRow = Math.max(start.rowIndex, end.rowIndex);
      const minColIdx = Math.min(letterToColIndex(start.columnId), letterToColIndex(end.columnId));
      const maxColIdx = Math.max(letterToColIndex(start.columnId), letterToColIndex(end.columnId));
      if (rowIndex >= minRow && rowIndex <= maxRow && hfCol >= minColIdx && hfCol <= maxColIdx) {
        try {
          if (rule.condition(value)) {
            mergedFormat = { ...mergedFormat, ...rule.style };
          }
        } catch {
          // Skip invalid condition
        }
      }
    }
  }

  // Build inline style from merged format
  const formatStyle: React.CSSProperties = {};
  if (mergedFormat.bold) formatStyle.fontWeight = "bold";
  if (mergedFormat.italic) formatStyle.fontStyle = "italic";
  if (mergedFormat.color) formatStyle.color = mergedFormat.color;
  if (mergedFormat.bgColor) formatStyle.backgroundColor = mergedFormat.bgColor;
  if (mergedFormat.align) formatStyle.justifyContent = mergedFormat.align === "center" ? "center" : mergedFormat.align === "right" ? "flex-end" : "flex-start";

  const showSelectionOverlay = isSelected && !isRowNumberCol && !isActive;
  // Only show the ring on the active cell when there's no multi-cell selection outline.
  // When a range is selected, the selection outline covers the entire range boundary.
  const showActiveRing = isActive && !isRowNumberCol && !selectionOutline;
  const selectionClasses = [
    showActiveRing ? "ring-2 ring-primary ring-inset z-[5]" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
      <div
        role="gridcell"
        tabIndex={isRowNumberCol ? undefined : -1}
        data-col-id={columnId}
        data-row-selected={currentRowSelected || undefined}
        className={`absolute top-0 left-0 flex items-center border-r border-b border-border px-2 overflow-hidden text-ellipsis whitespace-nowrap text-sm select-none ${
        isGrouped ? "font-semibold bg-muted/40" : ""
      } ${isAggregated ? "text-muted-foreground italic" : ""} ${
        editable && !isRowNumberCol ? "cursor-cell" : ""
      } ${hasFormulaError ? "text-destructive" : ""} ${selectionClasses}`}
        style={{
          width,
          height,
        transform: `translateX(${translateX}px)`,
        paddingLeft: indentPx > 0 ? `${indentPx + 8}px` : undefined,
        ...formatStyle,
      }}
      title={hasFormulaError ? displayValue : undefined}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
        >
          {showSelectionOverlay && (
            <div className="pointer-events-none absolute inset-0 z-[1] bg-primary/10" />
          )}
          {selectionOutline && !isRowNumberCol && renderSolidOutline(selectionOutline, "var(--primary)", 4)}
          {clipboardOutline && clipboardMode && !isRowNumberCol && renderClipboardOutline(clipboardOutline, clipboardMode)}

          {formulaReferenceColor && !isRowNumberCol && (
            <div
              className="pointer-events-none absolute inset-[2px] z-[3] rounded-[3px] border-2 border-dashed"
            style={{ borderColor: formulaReferenceColor }}
          />
        )}

        {showTreeControls && canExpand && (
          <button
          type="button"
          onMouseDown={handleChevronMouseDown}
          onClick={handleChevronClick}
          onKeyDown={handleChevronKeyDown}
          className="mr-1 flex-shrink-0 p-0.5 rounded hover:bg-muted cursor-pointer"
          aria-label={isExpanded ? "Collapse row" : "Expand row"}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {isGrouped ? (
        <span>
          {displayValue} ({row.subRows.length})
        </span>
      ) : isRowNumberCol ? (
        flexRender(cell.column.columnDef.cell, cell.getContext())
      ) : typeof value === "boolean" ? (
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={value}
          readOnly={!editable}
          tabIndex={-1}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleBooleanToggle(e.target.checked)}
        />
      ) : (
        displayValue
      )}
    </div>
  );
});
