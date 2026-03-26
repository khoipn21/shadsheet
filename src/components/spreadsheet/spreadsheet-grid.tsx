import { useContext, useRef, useCallback, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TableContext } from "./spreadsheet-provider";
import { ColumnHeaders } from "./column-headers";
import { CellRenderer } from "./cell-renderer";
import { ContextMenu } from "./context-menu";
import { StatusBar } from "./status-bar";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { useHyperFormula } from "@/hooks/use-hyperformula";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { useCellSelection } from "@/hooks/use-cell-selection";
import { useClipboard } from "@/hooks/use-clipboard";
import { useAutoFill } from "@/hooks/use-auto-fill";
import { useGridOperations } from "@/hooks/use-grid-operations";
import type { CellValue, ConditionalFormatRule, SpreadsheetTableMeta, SpreadsheetColumnConfig } from "@/types/spreadsheet-types";
import { letterToColIndex } from "@/utils/cell-address";
import { getCellRawValue } from "@/utils/formula-utils";
import {
  getFormulaReferenceColorMap,
  isFormulaValue,
} from "@/utils/formula-reference-utils";
import { isCellEditable } from "@/utils/validation-utils";
import type { Row, Cell } from "@tanstack/react-table";

const ROW_HEIGHT = 35;
const DEFAULT_COL_WIDTH = 120;
const ROW_OVERSCAN = 10;
const COL_OVERSCAN = 2;

interface SpreadsheetGridProps {
  className?: string;
  conditionalFormats?: ConditionalFormatRule[];
  apiRef?: React.MutableRefObject<SpreadsheetGridApi | null>;
}

export interface SpreadsheetGridApi {
  focus: () => void;
  scrollToCell: (rowIndex: number, column: number | string) => void;
  getVisibleColumnIds: () => string[];
}

export function SpreadsheetGrid({
  className,
  conditionalFormats,
  apiRef,
}: SpreadsheetGridProps) {
  const table = useContext(TableContext);
  if (!table) throw new Error("SpreadsheetGrid must be used within SpreadsheetProvider");

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hf = useHyperFormula();
  const gridColumns = useSpreadsheetStore((s) => s.columns);
  const gridSorting = useSpreadsheetStore((s) => s.sorting);
  const gridColumnFilters = useSpreadsheetStore((s) => s.columnFilters);
  const gridGlobalFilter = useSpreadsheetStore((s) => s.globalFilter);
  const gridColumnOrder = useSpreadsheetStore((s) => s.columnOrder);
  const gridColumnPinning = useSpreadsheetStore((s) => s.columnPinning);
  const gridColumnVisibility = useSpreadsheetStore((s) => s.columnVisibility);
  const gridRowSelection = useSpreadsheetStore((s) => s.rowSelection);
  const gridExpanded = useSpreadsheetStore((s) => s.expanded);
  const gridGrouping = useSpreadsheetStore((s) => s.grouping);
  const incrementRenderTrigger = useSpreadsheetStore((s) => s.incrementRenderTrigger);
    const rowPinning = useSpreadsheetStore((s) => s.rowPinning);
    const activeCell = useSpreadsheetStore((s) => s.activeCell);
    const editingCell = useSpreadsheetStore((s) => s.editingCell);
    const editValue = useSpreadsheetStore((s) => s.editValue);
    const formulaPreviewValue = useSpreadsheetStore((s) => s.formulaPreviewValue);
    const formulaRenderTrigger = useSpreadsheetStore((s) => s.renderTrigger);
    const selectionRange = useSpreadsheetStore((s) => s.selectionRange);
    const setActiveCell = useSpreadsheetStore((s) => s.setActiveCell);
  const setSelection = useSpreadsheetStore((s) => s.setSelection);
  const startEditing = useSpreadsheetStore((s) => s.startEditing);

  const setContextMenu = useSpreadsheetStore((s) => s.setContextMenu);
  const setSorting = useSpreadsheetStore((s) => s.setSorting);
  const { insertRow, deleteRow, insertColumn, deleteColumn } = useGridOperations();
  void gridColumns;
  void gridSorting;
  void gridColumnFilters;
  void gridGlobalFilter;
  void gridColumnOrder;
  void gridColumnPinning;
  void gridColumnVisibility;
    void gridRowSelection;
    void gridExpanded;
    void gridGrouping;
    void formulaRenderTrigger;

  const meta = table.options.meta as SpreadsheetTableMeta | undefined;
  const allRows = table.getRowModel().rows;

  // Separate pinned rows from scrollable rows
  const pinnedTopIds = useMemo(() => new Set(rowPinning.top), [rowPinning.top]);
  const pinnedBottomIds = useMemo(() => new Set(rowPinning.bottom), [rowPinning.bottom]);

  const pinnedTopRows = useMemo(
    () => allRows.filter((r) => pinnedTopIds.has(r.id)),
    [allRows, pinnedTopIds],
  );
  const pinnedBottomRows = useMemo(
    () => allRows.filter((r) => pinnedBottomIds.has(r.id)),
    [allRows, pinnedBottomIds],
  );
  const scrollableRows = useMemo(
    () => allRows.filter((r) => !pinnedTopIds.has(r.id) && !pinnedBottomIds.has(r.id)),
    [allRows, pinnedTopIds, pinnedBottomIds],
  );

  const leftColumns = table.getLeftVisibleLeafColumns();
  const centerColumns = table.getCenterVisibleLeafColumns();
  const rightColumns = table.getRightVisibleLeafColumns();

  const hasLeftPinned = leftColumns.length > 0;
  const hasRightPinned = rightColumns.length > 0;

  // Build ordered list of visible data column IDs (exclude _row_number)
  const visibleColumnIds = useMemo(
    () =>
      [...leftColumns, ...centerColumns, ...rightColumns]
        .map((col) => col.id)
        .filter((id) => id !== "_row_number"),
    [leftColumns, centerColumns, rightColumns],
  );

  // Column ID → visual index map (for selection range checks)
  const columnIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    visibleColumnIds.forEach((id, i) => map.set(id, i));
    return map;
  }, [visibleColumnIds]);

    const totalRowCount = scrollableRows.length;

    const currentFormulaValue = useMemo(() => {
      void formulaRenderTrigger;

      if (editingCell) {
        if (editValue !== null) {
          return String(editValue);
        }
        if (!hf) return "";
        return getCellRawValue(
          hf,
          editingCell.rowIndex,
          letterToColIndex(editingCell.columnId),
        );
      }

      if (formulaPreviewValue !== null) {
        return formulaPreviewValue;
      }

      if (!activeCell || !hf) {
        return "";
      }

      return getCellRawValue(
        hf,
        activeCell.rowIndex,
        letterToColIndex(activeCell.columnId),
      );
    }, [activeCell, editValue, editingCell, formulaPreviewValue, formulaRenderTrigger, hf]);

    const formulaReferenceColorMap = useMemo(
      () =>
        isFormulaValue(currentFormulaValue)
          ? getFormulaReferenceColorMap(currentFormulaValue)
          : new Map<string, string>(),
      [currentFormulaValue],
    );

  const getRowKey = useCallback(
    (index: number) => scrollableRows[index]?.id ?? index,
    [scrollableRows],
  );

  // Shared row virtualizer — all 3 panes use same visible row range
  const rowVirtualizer = useVirtualizer({
    count: scrollableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: ROW_OVERSCAN,
    getItemKey: getRowKey,
  });

  // Column virtualizer — center pane only
  const colVirtualizer = useVirtualizer({
    count: centerColumns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(
      (index: number) => centerColumns[index]?.getSize() ?? DEFAULT_COL_WIDTH,
      [centerColumns],
    ),
    horizontal: true,
    overscan: COL_OVERSCAN,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = colVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalCenterWidth = colVirtualizer.getTotalSize();

  // Total widths for pinned panes (non-virtualized)
  const leftWidth = leftColumns.reduce((sum, col) => sum + (col.getSize() ?? DEFAULT_COL_WIDTH), 0);
  const rightWidth = rightColumns.reduce((sum, col) => sum + (col.getSize() ?? DEFAULT_COL_WIDTH), 0);

  const pinnedTopHeight = pinnedTopRows.length * ROW_HEIGHT;
  const pinnedBottomHeight = pinnedBottomRows.length * ROW_HEIGHT;

  const selectedCount = Object.keys(table.getState().rowSelection).length;

  // Approximate viewport row count for PageUp/Down
  const viewportRowCount = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 500) / ROW_HEIGHT));

  // Get cell value helper
  const getCellValue = useCallback(
    (rowIndex: number, columnId: string): CellValue => {
      const row = scrollableRows[rowIndex];
      if (!row) return null;
      return row.getValue(columnId) as CellValue;
    },
    [scrollableRows],
  );

  // Check if a cell is editable (respects column config + row-level editable functions)
  const canEditCell = useCallback(
    (rowIndex: number, columnId: string): boolean => {
      const colConfig = meta?.getColumnConfig(columnId) as SpreadsheetColumnConfig | undefined;
      const row = scrollableRows[rowIndex];
      return isCellEditable(colConfig, row?.original);
    },
    [meta, scrollableRows],
  );

  // --- Hooks ---

  const { handleKeyDown } = useKeyboardNavigation({
    activeCell,
    editingCell,
    selectionRange,
    setActiveCell,
    setSelection,
    startEditing,
    visibleColumnIds,
    totalRowCount,
    viewportRowCount,
    meta,
    canEditCell,
    rowVirtualizer,
    colVirtualizer,
    hf,
    incrementRenderTrigger,
  });

  const { handleCellMouseDown, handleCellMouseEnter, handleMouseUp } = useCellSelection({
    activeCell,
    setActiveCell,
    setSelection,
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

  const { fillHandlePosition, handleFillStart, handleFillEnd } = useAutoFill({
    activeCell,
    selectionRange,
    visibleColumnIds,
    totalRowCount,
    hf,
    incrementRenderTrigger,
  });

  // Combined keyboard handler: navigation + clipboard shortcuts
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      // Clipboard shortcuts (work in both edit and non-edit mode for grid-level handler)
      if (!editingCell && ctrl) {
        if (e.key === "c") { e.preventDefault(); handleCopy(); return; }
        if (e.key === "x") { e.preventDefault(); handleCut(); return; }
        if (e.key === "v") { e.preventDefault(); handlePaste(); return; }
      }
      handleKeyDown(e);
    },
    [editingCell, handleKeyDown, handleCopy, handleCut, handlePaste],
  );

  // Right-click context menu handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Find the closest gridcell to determine which cell was right-clicked
      const target = (e.target as HTMLElement).closest("[data-col-id]");
      if (!target) return;
      const colId = target.getAttribute("data-col-id");
      if (!colId || colId === "_row_number") return;

      e.preventDefault();
      // Determine row index from the virtual row structure
      const rowEl = target.closest("[data-row-index]");
      const rowIdx = rowEl ? parseInt(rowEl.getAttribute("data-row-index") ?? "0", 10) : (activeCell?.rowIndex ?? 0);

      setContextMenu({ x: e.clientX, y: e.clientY, cell: { rowIndex: rowIdx, columnId: colId } });
    },
    [activeCell, setContextMenu],
  );

  // Sort handler for context menu
  const handleSort = useCallback(
    (columnId: string, desc: boolean) => {
      setSorting([{ id: columnId, desc }]);
    },
    [setSorting],
  );

  // Navigate after editor commit (Enter/Tab move to adjacent cell)
  const handleNavigate = useCallback(
    (fromRow: number, fromColumnId: string, direction: "up" | "down" | "left" | "right") => {
      const colIdx = visibleColumnIds.indexOf(fromColumnId);
      if (colIdx === -1) return;

      let nextRow = fromRow;
      let nextCol = colIdx;

      switch (direction) {
        case "up": nextRow = Math.max(0, fromRow - 1); break;
        case "down": nextRow = Math.min(totalRowCount - 1, fromRow + 1); break;
        case "left": {
          nextCol = colIdx - 1;
          if (nextCol < 0) { nextCol = visibleColumnIds.length - 1; nextRow = Math.max(0, nextRow - 1); }
          break;
        }
        case "right": {
          nextCol = colIdx + 1;
          if (nextCol >= visibleColumnIds.length) { nextCol = 0; nextRow = Math.min(totalRowCount - 1, nextRow + 1); }
          break;
        }
      }

      const next = { rowIndex: nextRow, columnId: visibleColumnIds[nextCol] };
      setActiveCell(next);
      setSelection(null);
      // Re-focus grid container so keyboard navigation continues
      gridRef.current?.focus();
    },
    [visibleColumnIds, totalRowCount, setActiveCell, setSelection],
  );

  // Check if a cell is in the current selection range
  const isCellSelected = useCallback(
    (rowIndex: number, columnId: string): boolean => {
      if (!selectionRange) return false;
      const { start, end } = selectionRange;
      const minRow = Math.min(start.rowIndex, end.rowIndex);
      const maxRow = Math.max(start.rowIndex, end.rowIndex);
      const sc = columnIdToIndex.get(start.columnId);
      const ec = columnIdToIndex.get(end.columnId);
      const cc = columnIdToIndex.get(columnId);
      if (sc == null || ec == null || cc == null) return false;
      const minCol = Math.min(sc, ec);
      const maxCol = Math.max(sc, ec);
      return rowIndex >= minRow && rowIndex <= maxRow && cc >= minCol && cc <= maxCol;
    },
    [selectionRange, columnIdToIndex],
  );

    const isCellActive = useCallback(
      (rowIndex: number, columnId: string): boolean =>
        activeCell?.rowIndex === rowIndex && activeCell?.columnId === columnId,
      [activeCell],
    );

    const getFormulaReferenceColor = useCallback(
      (rowIndex: number, columnId: string) =>
        formulaReferenceColorMap.get(`${rowIndex}:${columnId}`),
      [formulaReferenceColorMap],
    );

  useEffect(() => {
    if (!apiRef) return;

    apiRef.current = {
      focus: () => {
        gridRef.current?.focus();
      },
      scrollToCell: (rowIndex: number, column: number | string) => {
        rowVirtualizer.scrollToIndex(Math.max(0, rowIndex), { align: "auto" });

        const targetColumnId =
          typeof column === "number" ? visibleColumnIds[column] : column;
        if (!targetColumnId) return;

        const centerColumnIndex = centerColumns.findIndex(
          (centerColumn) => centerColumn.id === targetColumnId,
        );
        if (centerColumnIndex !== -1) {
          colVirtualizer.scrollToIndex(centerColumnIndex, { align: "auto" });
        }

        gridRef.current?.focus();
      },
      getVisibleColumnIds: () => visibleColumnIds,
    };

    return () => {
      apiRef.current = null;
    };
  }, [apiRef, centerColumns, colVirtualizer, rowVirtualizer, visibleColumnIds]);

  return (
    <div
      ref={gridRef}
      className={`flex flex-col border border-border rounded-md overflow-hidden outline-none ${className ?? ""}`}
      tabIndex={0}
      role="grid"
      onKeyDown={handleGridKeyDown}
      onMouseUp={(e) => { handleMouseUp(); handleFillEnd(); void e; }}
      onContextMenu={handleContextMenu}
    >
      {/* Pinned top rows — fixed above scroll area */}
      {pinnedTopRows.length > 0 && (
        <FixedRowBand
          rows={pinnedTopRows}
          bandHeight={pinnedTopHeight}
          centerColumns={centerColumns}
          hasLeftPinned={hasLeftPinned}
          hasRightPinned={hasRightPinned}
          leftWidth={leftWidth}
          rightWidth={rightWidth}
          label="pinned-top"
          isCellActive={isCellActive}
          isCellSelected={isCellSelected}
            onCellMouseDown={handleCellMouseDown}
            onCellMouseEnter={handleCellMouseEnter}
            getFormulaReferenceColor={getFormulaReferenceColor}
            onNavigate={handleNavigate}
          />
      )}

      <div ref={scrollRef} className="relative overflow-auto flex-1">
        {/* Column headers row */}
        <ColumnHeaders scrollRef={scrollRef} />

        {/* 3-pane body: left-pinned | center-virtualized | right-pinned */}
        <div className="flex" style={{ minHeight: totalHeight }}>
          {/* Left pinned pane */}
          {hasLeftPinned && (
            <PinnedPane
              rows={scrollableRows}
              virtualRows={virtualRows}
              totalHeight={totalHeight}
              paneWidth={leftWidth}
              side="left"
              isCellActive={isCellActive}
              isCellSelected={isCellSelected}
                onCellMouseDown={handleCellMouseDown}
                onCellMouseEnter={handleCellMouseEnter}
                getFormulaReferenceColor={getFormulaReferenceColor}
                onNavigate={handleNavigate}
              />
          )}

          {/* Center virtualized pane */}
          <div style={{ width: totalCenterWidth, height: totalHeight, position: "relative", flexShrink: 0 }}>
            {virtualRows.map((virtualRow) => {
              const row = scrollableRows[virtualRow.index];
              const centerCells = row.getCenterVisibleCells();
              const isRowSelected = row.getIsSelected();

              return (
                <div
                  key={row.id}
                  data-row-index={row.index}
                  className={`absolute left-0 w-full ${isRowSelected ? "bg-primary/5" : ""}`}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {virtualCols.map((virtualCol) => {
                    const cell = centerCells[virtualCol.index];
                    if (!cell) return null;
                    const cId = cell.column.id;
                    const rIdx = cell.row.index;
                    return (
                      <CellRenderer
                        key={cell.id}
                        cell={cell as Cell<Record<string, CellValue>, unknown>}
                        width={virtualCol.size}
                        height={virtualRow.size}
                        translateX={virtualCol.start}
                        isActive={isCellActive(rIdx, cId)}
                          isSelected={isCellSelected(rIdx, cId)}
                          rowSelected={isRowSelected}
                          rowExpanded={row.getIsExpanded()}
                          formulaReferenceColor={getFormulaReferenceColor(rIdx, cId)}
                          onCellMouseDown={handleCellMouseDown}
                          onCellMouseEnter={handleCellMouseEnter}
                          onNavigate={handleNavigate}
                        conditionalFormats={conditionalFormats}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* Fill handle — small square at bottom-right of active cell */}
            {fillHandlePosition && activeCell && !editingCell && (() => {
              const vr = virtualRows.find((v) => v.index === fillHandlePosition.maxRow);
              const vc = virtualCols.find((v) => {
                const col = centerColumns[v.index];
                return col && col.id === visibleColumnIds[fillHandlePosition.maxCol];
              });
              if (!vr || !vc) return null;
              return (
                <div
                  className="absolute z-10 w-2 h-2 bg-primary border border-background cursor-crosshair"
                  style={{
                    top: vr.start + vr.size - 4,
                    left: vc.start + vc.size - 4,
                  }}
                  onMouseDown={handleFillStart}
                />
              );
            })()}
          </div>

          {/* Right pinned pane */}
          {hasRightPinned && (
            <PinnedPane
              rows={scrollableRows}
              virtualRows={virtualRows}
              totalHeight={totalHeight}
              paneWidth={rightWidth}
              side="right"
              isCellActive={isCellActive}
              isCellSelected={isCellSelected}
                onCellMouseDown={handleCellMouseDown}
                onCellMouseEnter={handleCellMouseEnter}
                getFormulaReferenceColor={getFormulaReferenceColor}
                onNavigate={handleNavigate}
              />
          )}
        </div>
      </div>

      {/* Pinned bottom rows — fixed below scroll area */}
      {pinnedBottomRows.length > 0 && (
        <FixedRowBand
          rows={pinnedBottomRows}
          bandHeight={pinnedBottomHeight}
          centerColumns={centerColumns}
          hasLeftPinned={hasLeftPinned}
          hasRightPinned={hasRightPinned}
          leftWidth={leftWidth}
          rightWidth={rightWidth}
          label="pinned-bottom"
          isCellActive={isCellActive}
          isCellSelected={isCellSelected}
            onCellMouseDown={handleCellMouseDown}
            onCellMouseEnter={handleCellMouseEnter}
            getFormulaReferenceColor={getFormulaReferenceColor}
            onNavigate={handleNavigate}
          />
      )}

      {/* Status bar with aggregates */}
      <StatusBar
        totalRows={allRows.length}
        totalColumns={table.getVisibleLeafColumns().length}
        selectedRowCount={selectedCount}
        visibleColumnIds={visibleColumnIds}
      />

      {/* Context menu (Portal) */}
      <ContextMenu
        visibleColumnIds={visibleColumnIds}
        totalRowCount={totalRowCount}
        meta={meta}
        getCellValue={getCellValue}
        canEditCell={canEditCell}
        onSort={handleSort}
        onInsertRow={insertRow}
        onDeleteRow={deleteRow}
        onInsertColumn={insertColumn}
        onDeleteColumn={deleteColumn}
      />
    </div>
  );
}

// --- Shared selection callback types ---
interface SelectionCallbacks {
  isCellActive: (rowIndex: number, columnId: string) => boolean;
  isCellSelected: (rowIndex: number, columnId: string) => boolean;
  onCellMouseDown: (rowIndex: number, columnId: string, shiftKey: boolean) => void;
  onCellMouseEnter: (rowIndex: number, columnId: string) => void;
  getFormulaReferenceColor: (
    rowIndex: number,
    columnId: string,
  ) => string | undefined;
  onNavigate: (fromRow: number, fromColumnId: string, direction: "up" | "down" | "left" | "right") => void;
}

/** Non-virtualized pinned column pane (left or right) */
function PinnedPane({
  rows,
  virtualRows,
  totalHeight,
  paneWidth,
  side,
  isCellActive,
  isCellSelected,
  onCellMouseDown,
  onCellMouseEnter,
  getFormulaReferenceColor,
  onNavigate,
}: {
  rows: Row<Record<string, CellValue>>[];
  virtualRows: { index: number; start: number; size: number }[];
  totalHeight: number;
  paneWidth: number;
  side: "left" | "right";
} & SelectionCallbacks) {
  return (
    <div
      className={`sticky ${side === "left" ? "left-0" : "right-0"} z-[5] bg-background`}
      style={{ width: paneWidth, flexShrink: 0, height: totalHeight, position: "relative" }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        const cells = side === "left" ? row.getLeftVisibleCells() : row.getRightVisibleCells();
        const isSelected = row.getIsSelected();

        let offset = 0;
        return (
          <div
            key={row.id}
            className={`absolute left-0 w-full ${isSelected ? "bg-primary/5" : ""}`}
            style={{
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {cells.map((cell) => {
              const width = cell.column.getSize();
              const translateX = offset;
              offset += width;
              const cId = cell.column.id;
              const rIdx = cell.row.index;
                return (
                  <CellRenderer
                    key={cell.id}
                    cell={cell as Cell<Record<string, CellValue>, unknown>}
                    width={width}
                    height={virtualRow.size}
                    translateX={translateX}
                      isActive={isCellActive(rIdx, cId)}
                      isSelected={isCellSelected(rIdx, cId)}
                      rowSelected={isSelected}
                      rowExpanded={row.getIsExpanded()}
                      formulaReferenceColor={getFormulaReferenceColor(rIdx, cId)}
                      onCellMouseDown={onCellMouseDown}
                      onCellMouseEnter={onCellMouseEnter}
                      onNavigate={onNavigate}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Fixed row band for pinned-top or pinned-bottom rows (not virtualized) */
function FixedRowBand({
  rows,
  bandHeight,
  centerColumns,
  hasLeftPinned,
  hasRightPinned,
  leftWidth,
  rightWidth,
  label,
  isCellActive,
  isCellSelected,
  onCellMouseDown,
  onCellMouseEnter,
  getFormulaReferenceColor,
  onNavigate,
}: {
  rows: Row<Record<string, CellValue>>[];
  bandHeight: number;
  centerColumns: { id: string; getSize: () => number }[];
  hasLeftPinned: boolean;
  hasRightPinned: boolean;
  leftWidth: number;
  rightWidth: number;
  label: string;
} & SelectionCallbacks) {
  const centerWidth = centerColumns.reduce((sum, col) => sum + (col.getSize() ?? DEFAULT_COL_WIDTH), 0);

  return (
    <div
      className="flex border-b border-border bg-muted/20"
      style={{ height: bandHeight }}
      data-band={label}
    >
      {hasLeftPinned && (
        <div style={{ width: leftWidth, flexShrink: 0 }}>
          {rows.map((row) => {
            const cells = row.getLeftVisibleCells();
            let offset = 0;
            return (
              <div key={row.id} className="relative" style={{ height: ROW_HEIGHT }}>
                {cells.map((cell) => {
                  const width = cell.column.getSize();
                  const translateX = offset;
                  offset += width;
                  const cId = cell.column.id;
                  const rIdx = cell.row.index;
                    return (
                      <CellRenderer
                        key={cell.id}
                        cell={cell as Cell<Record<string, CellValue>, unknown>}
                        width={width}
                        height={ROW_HEIGHT}
                        translateX={translateX}
                          isActive={isCellActive(rIdx, cId)}
                          isSelected={isCellSelected(rIdx, cId)}
                          rowSelected={row.getIsSelected()}
                          rowExpanded={row.getIsExpanded()}
                          formulaReferenceColor={getFormulaReferenceColor(rIdx, cId)}
                          onCellMouseDown={onCellMouseDown}
                          onCellMouseEnter={onCellMouseEnter}
                          onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ width: centerWidth, flexShrink: 0, position: "relative" }}>
        {rows.map((row) => {
          const centerCells = row.getCenterVisibleCells();
          let offset = 0;
          return (
            <div key={row.id} className="relative" style={{ height: ROW_HEIGHT }}>
              {centerCells.map((cell) => {
                const width = cell.column.getSize();
                const translateX = offset;
                offset += width;
                const cId = cell.column.id;
                const rIdx = cell.row.index;
                    return (
                      <CellRenderer
                        key={cell.id}
                        cell={cell as Cell<Record<string, CellValue>, unknown>}
                        width={width}
                        height={ROW_HEIGHT}
                        translateX={translateX}
                          isActive={isCellActive(rIdx, cId)}
                          isSelected={isCellSelected(rIdx, cId)}
                          rowSelected={row.getIsSelected()}
                          rowExpanded={row.getIsExpanded()}
                          formulaReferenceColor={getFormulaReferenceColor(rIdx, cId)}
                          onCellMouseDown={onCellMouseDown}
                          onCellMouseEnter={onCellMouseEnter}
                          onNavigate={onNavigate}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {hasRightPinned && (
        <div style={{ width: rightWidth, flexShrink: 0 }}>
          {rows.map((row) => {
            const cells = row.getRightVisibleCells();
            let offset = 0;
            return (
              <div key={row.id} className="relative" style={{ height: ROW_HEIGHT }}>
                {cells.map((cell) => {
                  const width = cell.column.getSize();
                  const translateX = offset;
                  offset += width;
                  const cId = cell.column.id;
                  const rIdx = cell.row.index;
                    return (
                      <CellRenderer
                        key={cell.id}
                        cell={cell as Cell<Record<string, CellValue>, unknown>}
                        width={width}
                        height={ROW_HEIGHT}
                        translateX={translateX}
                          isActive={isCellActive(rIdx, cId)}
                          isSelected={isCellSelected(rIdx, cId)}
                          rowSelected={row.getIsSelected()}
                          rowExpanded={row.getIsExpanded()}
                          formulaReferenceColor={getFormulaReferenceColor(rIdx, cId)}
                          onCellMouseDown={onCellMouseDown}
                          onCellMouseEnter={onCellMouseEnter}
                          onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
