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
import { useMergeCells } from "@/hooks/use-merge-cells";
import type {
  CellValue,
  ClipboardSelectionMode,
  ConditionalFormatRule,
  SelectionRange,
  SpreadsheetColumnConfig,
  SpreadsheetTableMeta,
} from "@/types/spreadsheet-types";
import { letterToColIndex } from "@/utils/cell-address";
import { findVisibleMerges, buildMergeIntervals } from "@/utils/merge-interval-tree";
import { getCellDisplayValue, getCellRawValue } from "@/utils/formula-utils";
import {
  getFormulaReferenceColorMap,
  isFormulaValue,
} from "@/utils/formula-reference-utils";
import {
  getMergeEndCol,
  getMergeEndRow,
  getMergeLookupResult,
} from "@/utils/merge-cell-utils";
import { isCellEditable } from "@/utils/validation-utils";
import type { Row, Cell } from "@tanstack/react-table";

const ROW_HEIGHT = 35;
const DEFAULT_COL_WIDTH = 120;
const ROW_OVERSCAN = 10;
const COL_OVERSCAN = 2;

interface CellOutline {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

interface MergeOutlineBounds {
  endRow: number;
  endColIndex: number;
}

interface CellMergeRenderState {
  isCovered: boolean;
  mergeSpan: {
    rowSpan: number;
    colSpan: number;
    totalWidth: number;
    totalHeight: number;
  } | null;
  outlineBounds: MergeOutlineBounds | null;
}

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
  const prevVisibleColumnSignatureRef = useRef<string | null>(null);
  const prevVisibleColumnIdsRef = useRef<string[] | null>(null);
  const hf = useHyperFormula();
  const gridColumns = useSpreadsheetStore((s) => s.columns);
  const gridSorting = useSpreadsheetStore((s) => s.sorting);
  const gridColumnFilters = useSpreadsheetStore((s) => s.columnFilters);
  const gridGlobalFilter = useSpreadsheetStore((s) => s.globalFilter);
  const gridColumnOrder = useSpreadsheetStore((s) => s.columnOrder);
  const gridColumnResizePreview = useSpreadsheetStore((s) => s.columnResizePreview);
  const clipboardSelection = useSpreadsheetStore((s) => s.clipboardSelection);
  const clipboardSelectionMode = useSpreadsheetStore((s) => s.clipboardSelectionMode);
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
    const mergedCells = useSpreadsheetStore((s) => s.mergedCells);
  const mergedCellLookup = useSpreadsheetStore((s) => s.mergedCellLookup);
  const setActiveCell = useSpreadsheetStore((s) => s.setActiveCell);
  const setSelection = useSpreadsheetStore((s) => s.setSelection);
  const startEditing = useSpreadsheetStore((s) => s.startEditing);
  const reindexMergedCells = useSpreadsheetStore((s) => s.reindexMergedCells);

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
  const mergeVirtualized = meta?.featureFlags.mergeVirtualized ?? false;
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
  const pinnedRowIndexes = useMemo(
    () => new Set([...pinnedTopRows, ...pinnedBottomRows].map((row) => row.index)),
    [pinnedBottomRows, pinnedTopRows],
  );
  const scrollableRows = useMemo(
    () => allRows.filter((r) => !pinnedTopIds.has(r.id) && !pinnedBottomIds.has(r.id)),
    [allRows, pinnedTopIds, pinnedBottomIds],
  );
  const rowByIndex = useMemo(() => {
    const map = new Map<number, Row<Record<string, CellValue>>>();
    allRows.forEach((row) => map.set(row.index, row));
    return map;
  }, [allRows]);

  const leftColumns = table.getLeftVisibleLeafColumns();
  const centerColumns = table.getCenterVisibleLeafColumns();
  const rightColumns = table.getRightVisibleLeafColumns();
  const leftDataColumns = useMemo(
    () => leftColumns.filter((column) => column.id !== "_row_number"),
    [leftColumns],
  );
  const centerDataColumns = useMemo(
    () => centerColumns.filter((column) => column.id !== "_row_number"),
    [centerColumns],
  );
  const rightDataColumns = useMemo(
    () => rightColumns.filter((column) => column.id !== "_row_number"),
    [rightColumns],
  );

  const hasLeftPinned = leftColumns.length > 0;
  const hasRightPinned = rightColumns.length > 0;

  // Build ordered list of visible data column IDs (exclude _row_number)
  const visibleColumnIds = useMemo(
    () =>
      [...leftDataColumns, ...centerDataColumns, ...rightDataColumns].map(
        (col) => col.id,
      ),
    [leftDataColumns, centerDataColumns, rightDataColumns],
  );

  // Column ID → visual index map (for selection range checks)
  const columnIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    visibleColumnIds.forEach((id, i) => map.set(id, i));
    return map;
  }, [visibleColumnIds]);
  const visibleColumnSignature = useMemo(
    () => visibleColumnIds.join("|"),
    [visibleColumnIds],
  );

  const visibleColumnWidths = useMemo(() => {
    const widthById = new Map<string, number>();
    for (const column of [...leftColumns, ...centerColumns, ...rightColumns]) {
      widthById.set(
        column.id,
        gridColumnResizePreview[column.id] ?? column.getSize() ?? DEFAULT_COL_WIDTH,
      );
    }
    return visibleColumnIds.map(
      (columnId) => widthById.get(columnId) ?? DEFAULT_COL_WIDTH,
    );
  }, [
    centerColumns,
    gridColumnResizePreview,
    leftColumns,
    rightColumns,
    visibleColumnIds,
  ]);

  const mergeDimensions = useMemo(
    () =>
      mergedCells.map((merge) => {
        let totalWidth = 0;
        const endCol = getMergeEndCol(merge);
        for (let col = merge.col; col <= endCol; col++) {
          totalWidth += visibleColumnWidths[col] ?? DEFAULT_COL_WIDTH;
        }
        return {
          totalWidth,
          totalHeight: merge.rowSpan * ROW_HEIGHT,
          endRow: getMergeEndRow(merge),
          endCol,
        };
      }),
    [mergedCells, visibleColumnWidths],
  );

  const mergeIntervals = useMemo(
    () => buildMergeIntervals(mergedCells),
    [mergedCells],
  );

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
      (index: number) => {
        const column = centerColumns[index];
        if (!column) return DEFAULT_COL_WIDTH;
        return gridColumnResizePreview[column.id] ?? column.getSize() ?? DEFAULT_COL_WIDTH;
      },
      [centerColumns, gridColumnResizePreview],
    ),
    horizontal: true,
    overscan: COL_OVERSCAN,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = colVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalCenterWidth = colVirtualizer.getTotalSize();
  const lastScrollableRowIndex =
    scrollableRows[scrollableRows.length - 1]?.index ?? 0;
  const visibleRowStart =
    virtualRows.length > 0
      ? (scrollableRows[virtualRows[0].index]?.index ?? 0)
      : (scrollableRows[0]?.index ?? 0);
  const visibleRowEnd =
    virtualRows.length > 0
      ? (scrollableRows[virtualRows[virtualRows.length - 1].index]?.index ??
        lastScrollableRowIndex)
      : lastScrollableRowIndex;
  const centerVisibleStartCol =
    leftDataColumns.length + (virtualCols[0]?.index ?? 0);
  const centerVisibleEndCol =
    leftDataColumns.length +
    (virtualCols[virtualCols.length - 1]?.index ??
      Math.max(centerDataColumns.length - 1, 0));
  const visibleMergeIndices = useMemo(() => {
    if (!mergeVirtualized || mergedCells.length === 0) return null;
    const rowStart = visibleRowStart;
    const rowEnd = visibleRowEnd;

    const sets: number[] = [];
    const leftCount = leftDataColumns.length;
    const centerCount = centerDataColumns.length;
    const rightCount = rightDataColumns.length;

    if (leftCount > 0) {
      sets.push(...findVisibleMerges(mergeIntervals, rowStart, rowEnd, 0, leftCount - 1));
    }

    if (centerCount > 0) {
      const centerStart = virtualCols[0]?.index ?? 0;
      const centerEnd = virtualCols[virtualCols.length - 1]?.index ?? centerCount - 1;
      sets.push(
        ...findVisibleMerges(
          mergeIntervals,
          rowStart,
          rowEnd,
          leftCount + centerStart,
          leftCount + centerEnd,
        ),
      );
    }

    if (rightCount > 0) {
      const startCol = visibleColumnIds.length - rightCount;
      sets.push(
        ...findVisibleMerges(
          mergeIntervals,
          rowStart,
          rowEnd,
          startCol,
          visibleColumnIds.length - 1,
        ),
      );
    }

    return new Set(sets);
  }, [
    centerDataColumns.length,
    leftDataColumns.length,
    mergeIntervals,
    mergeVirtualized,
    mergedCells.length,
    rightDataColumns.length,
    virtualCols,
    visibleRowEnd,
    visibleRowStart,
    visibleColumnIds.length,
  ]);
  const centerColumnSizeKey = centerColumns
    .map((column) => `${column.id}:${gridColumnResizePreview[column.id] ?? column.getSize()}`)
    .join("|");

  useEffect(() => {
    colVirtualizer.measure();
  }, [centerColumnSizeKey, colVirtualizer]);

  useEffect(() => {
    const previousSignature = prevVisibleColumnSignatureRef.current;
    const previousVisibleColumnIds = prevVisibleColumnIdsRef.current;
    if (
      previousVisibleColumnIds != null &&
      previousSignature != null &&
      previousSignature !== visibleColumnSignature &&
      mergedCells.length > 0
    ) {
      reindexMergedCells(previousVisibleColumnIds, visibleColumnIds);
    }
    prevVisibleColumnIdsRef.current = [...visibleColumnIds];
    prevVisibleColumnSignatureRef.current = visibleColumnSignature;
  }, [
    mergedCells.length,
    reindexMergedCells,
    visibleColumnIds,
    visibleColumnSignature,
  ]);

  // Total widths for pinned panes (non-virtualized)
  const leftWidth = leftColumns.reduce(
    (sum, col) => sum + (gridColumnResizePreview[col.id] ?? col.getSize() ?? DEFAULT_COL_WIDTH),
    0,
  );
  const rightWidth = rightColumns.reduce(
    (sum, col) => sum + (gridColumnResizePreview[col.id] ?? col.getSize() ?? DEFAULT_COL_WIDTH),
    0,
  );

  const pinnedTopHeight = pinnedTopRows.length * ROW_HEIGHT;
  const pinnedBottomHeight = pinnedBottomRows.length * ROW_HEIGHT;

  const selectedCount = Object.keys(table.getState().rowSelection).length;

  // Approximate viewport row count for PageUp/Down
  const viewportRowCount = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 500) / ROW_HEIGHT));

  // Get cell value helper
  const getCellValue = useCallback(
    (rowIndex: number, columnId: string): CellValue => {
      if (hf) {
        return getCellDisplayValue(hf, rowIndex, letterToColIndex(columnId));
      }
      const row = rowByIndex.get(rowIndex);
      if (!row) return null;
      return row.getValue(columnId) as CellValue;
    },
    [hf, rowByIndex],
  );

  // Check if a cell is editable (respects column config + row-level editable functions)
  const canEditCell = useCallback(
    (rowIndex: number, columnId: string): boolean => {
      const colConfig = meta?.getColumnConfig(columnId) as SpreadsheetColumnConfig | undefined;
      const row = rowByIndex.get(rowIndex);
      return isCellEditable(colConfig, row?.original);
    },
    [meta, rowByIndex],
  );

  const getCellMergeRenderState = useCallback(
    (rowIndex: number, columnId: string): CellMergeRenderState => {
      const colIndex = columnIdToIndex.get(columnId);
      if (colIndex == null) {
        return { isCovered: false, mergeSpan: null, outlineBounds: null };
      }

      const mergeIndex = mergedCellLookup.get(`${rowIndex}-${colIndex}`);
      if (mergeIndex == null) {
        return { isCovered: false, mergeSpan: null, outlineBounds: null };
      }

      const isWithinScrollableViewport =
        rowIndex >= visibleRowStart && rowIndex <= visibleRowEnd;
      if (
        visibleMergeIndices &&
        isWithinScrollableViewport &&
        !visibleMergeIndices.has(mergeIndex)
      ) {
        return { isCovered: false, mergeSpan: null, outlineBounds: null };
      }

      const merge = mergedCells[mergeIndex];
      const dimensions = mergeDimensions[mergeIndex];
      if (!merge || !dimensions) {
        return { isCovered: false, mergeSpan: null, outlineBounds: null };
      }

      const outlineBounds = {
        endRow: dimensions.endRow,
        endColIndex: dimensions.endCol,
      };
        const isAnchor = merge.row === rowIndex && merge.col === colIndex;
        if (!isAnchor) {
          if (!isWithinScrollableViewport || pinnedRowIndexes.has(merge.row)) {
            return { isCovered: true, mergeSpan: null, outlineBounds };
          }
          const leftCount = leftDataColumns.length;
          const centerCount = centerDataColumns.length;
          const rightCount = rightDataColumns.length;
        let paneColStart = 0;
        let paneColEnd = visibleColumnIds.length - 1;

        if (colIndex < leftCount) {
          paneColStart = 0;
          paneColEnd = leftCount - 1;
        } else if (colIndex >= leftCount + centerCount) {
          paneColStart = visibleColumnIds.length - rightCount;
          paneColEnd = visibleColumnIds.length - 1;
        } else {
          paneColStart = centerVisibleStartCol;
          paneColEnd = centerVisibleEndCol;
        }

        const fallbackRow = Math.max(merge.row, visibleRowStart);
        const fallbackCol = Math.max(merge.col, paneColStart);
        if (rowIndex === fallbackRow && colIndex === fallbackCol) {
          const visibleEndRow = Math.min(dimensions.endRow, visibleRowEnd);
          const visibleEndCol = Math.min(dimensions.endCol, paneColEnd);
          let fallbackWidth = 0;
          for (let col = colIndex; col <= visibleEndCol; col++) {
            fallbackWidth += visibleColumnWidths[col] ?? DEFAULT_COL_WIDTH;
          }
          return {
            isCovered: false,
            mergeSpan: {
              rowSpan: visibleEndRow - rowIndex + 1,
              colSpan: visibleEndCol - colIndex + 1,
              totalWidth: fallbackWidth,
              totalHeight: (visibleEndRow - rowIndex + 1) * ROW_HEIGHT,
            },
            outlineBounds: {
              endRow: visibleEndRow,
              endColIndex: visibleEndCol,
            },
          };
        }

        return { isCovered: true, mergeSpan: null, outlineBounds };
      }

      return {
        isCovered: false,
        mergeSpan: {
          rowSpan: merge.rowSpan,
          colSpan: merge.colSpan,
          totalWidth: dimensions.totalWidth,
          totalHeight: dimensions.totalHeight,
        },
        outlineBounds,
      };
    },
    [
      columnIdToIndex,
      centerDataColumns.length,
      centerVisibleEndCol,
      centerVisibleStartCol,
      leftDataColumns.length,
      mergeDimensions,
      mergedCellLookup,
      mergedCells,
      rightDataColumns.length,
      visibleColumnIds.length,
      visibleColumnWidths,
        visibleRowEnd,
        visibleRowStart,
        visibleMergeIndices,
        pinnedRowIndexes,
      ],
    );

  // --- Hooks ---
  const { toggleMerge } = useMergeCells({
    visibleColumnIds,
    leftPinnedCount: leftDataColumns.length,
    centerCount: centerDataColumns.length,
    onClearCellValue: (rowIndex, columnId, value) =>
      meta?.updateData(rowIndex, columnId, value) !== false,
  });

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
    mergedCells,
    mergedCellLookup,
    onToggleMerge: () => {
      void toggleMerge(selectionRange);
    },
  });

  const { handleCellMouseDown, handleCellMouseEnter, handleMouseUp } = useCellSelection({
    activeCell,
    setActiveCell,
    setSelection,
    visibleColumnIds,
    mergedCells,
    mergedCellLookup,
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

  const handleGridCellMouseDown = useCallback(
    (rowIndex: number, columnId: string, shiftKey: boolean) => {
      gridRef.current?.focus({ preventScroll: true });
      handleCellMouseDown(rowIndex, columnId, shiftKey);
    },
    [handleCellMouseDown],
  );

  // Keyboard handler: navigation/editing only. Clipboard uses native copy/cut/paste events.
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleKeyDown(e);
    },
    [handleKeyDown],
  );

  const handleGridCopy = useCallback(
    (e: React.ClipboardEvent) => {
      if (editingCell || (!activeCell && !selectionRange)) return;
      e.preventDefault();
      void handleCopy(e.clipboardData);
    },
    [activeCell, editingCell, handleCopy, selectionRange],
  );

  const handleGridCut = useCallback(
    (e: React.ClipboardEvent) => {
      if (editingCell || (!activeCell && !selectionRange)) return;
      e.preventDefault();
      void handleCut(e.clipboardData);
    },
    [activeCell, editingCell, handleCut, selectionRange],
  );

  const handleGridPaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (editingCell || !activeCell) return;
      e.preventDefault();
      void handlePaste(e.clipboardData.getData("text/plain"));
    },
    [activeCell, editingCell, handlePaste],
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
        const colIdx = visibleColumnIds.indexOf(colId);
        if (colIdx === -1) return;

        const mergeAtClick = getMergeLookupResult(
          mergedCells,
          mergedCellLookup,
          rowIdx,
          colIdx,
        );
        if (mergeAtClick) {
          const startColumnId = visibleColumnIds[mergeAtClick.merge.col] ?? colId;
          const endColumnId =
            visibleColumnIds[getMergeEndCol(mergeAtClick.merge)] ?? startColumnId;
          setActiveCell({
            rowIndex: mergeAtClick.merge.row,
            columnId: startColumnId,
          });
          setSelection({
            start: {
              rowIndex: mergeAtClick.merge.row,
              columnId: startColumnId,
            },
            end: {
              rowIndex: getMergeEndRow(mergeAtClick.merge),
              columnId: endColumnId,
            },
          });
        } else {
          setActiveCell({ rowIndex: rowIdx, columnId: colId });
          setSelection(null);
        }

        setContextMenu({ x: e.clientX, y: e.clientY, cell: { rowIndex: rowIdx, columnId: colId } });
      },
      [
        activeCell,
        mergedCellLookup,
        mergedCells,
        setActiveCell,
        setContextMenu,
        setSelection,
        visibleColumnIds,
      ],
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
      const maxCol = visibleColumnIds.length - 1;
      const maxRow = totalRowCount - 1;
      if (maxCol < 0 || maxRow < 0) return;

      const startCol = visibleColumnIds.indexOf(fromColumnId);
      if (startCol === -1) return;

      const normalizeToAnchor = (row: number, col: number) => {
        const merge = getMergeLookupResult(mergedCells, mergedCellLookup, row, col);
        if (!merge) return { row, col };
        return { row: merge.merge.row, col: merge.merge.col, merge };
      };

      const normalized = normalizeToAnchor(fromRow, startCol);
      let nextRow = normalized.row;
      let nextCol = normalized.col;
      const currentMerge = normalized.merge;

      switch (direction) {
        case "up":
          nextRow = currentMerge?.isAnchor
            ? currentMerge.merge.row - 1
            : normalized.row - 1;
          break;
        case "down":
          nextRow = currentMerge?.isAnchor
            ? currentMerge.merge.row + currentMerge.merge.rowSpan
            : normalized.row + 1;
          break;
        case "left":
          nextCol = currentMerge?.isAnchor
            ? currentMerge.merge.col - 1
            : normalized.col - 1;
          break;
        case "right":
          nextCol = currentMerge?.isAnchor
            ? currentMerge.merge.col + currentMerge.merge.colSpan
            : normalized.col + 1;
          break;
      }

      if (nextCol < 0) {
        nextCol = maxCol;
        nextRow -= 1;
      } else if (nextCol > maxCol) {
        nextCol = 0;
        nextRow += 1;
      }
      nextRow = Math.max(0, Math.min(nextRow, maxRow));
      nextCol = Math.max(0, Math.min(nextCol, maxCol));

      const snapped = normalizeToAnchor(nextRow, nextCol);
      const next = {
        rowIndex: snapped.row,
        columnId: visibleColumnIds[snapped.col],
      };
      setActiveCell(next);
      setSelection(null);
      // Re-focus grid container so keyboard navigation continues
      gridRef.current?.focus();
    },
    [
      mergedCellLookup,
      mergedCells,
      setActiveCell,
      setSelection,
      totalRowCount,
      visibleColumnIds,
    ],
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

  const getRangeOutline = useCallback(
    (
      range: SelectionRange | null,
      rowIndex: number,
      columnId: string,
      mergeOutline?: MergeOutlineBounds | null,
    ): CellOutline | null => {
      if (!range) return null;
      const { start, end } = range;
      const sc = columnIdToIndex.get(start.columnId);
      const ec = columnIdToIndex.get(end.columnId);
      const cc = columnIdToIndex.get(columnId);
      if (sc == null || ec == null || cc == null) return null;

      const minRow = Math.min(start.rowIndex, end.rowIndex);
      const maxRow = Math.max(start.rowIndex, end.rowIndex);
      const minCol = Math.min(sc, ec);
      const maxCol = Math.max(sc, ec);

      if (rowIndex < minRow || rowIndex > maxRow || cc < minCol || cc > maxCol) {
        return null;
      }
      const endRow = mergeOutline?.endRow ?? rowIndex;
      const endCol = mergeOutline?.endColIndex ?? cc;

      return {
        top: rowIndex === minRow,
        right: endCol === maxCol,
        bottom: endRow === maxRow,
        left: cc === minCol,
      };
    },
    [columnIdToIndex],
  );

  const getSelectionOutline = useCallback(
    (rowIndex: number, columnId: string, mergeOutline?: MergeOutlineBounds | null) =>
      getRangeOutline(selectionRange, rowIndex, columnId, mergeOutline),
    [getRangeOutline, selectionRange],
  );

  const getClipboardOutline = useCallback(
    (rowIndex: number, columnId: string, mergeOutline?: MergeOutlineBounds | null) =>
      getRangeOutline(clipboardSelection, rowIndex, columnId, mergeOutline),
    [clipboardSelection, getRangeOutline],
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
      onCopy={handleGridCopy}
      onCut={handleGridCut}
      onPaste={handleGridPaste}
      onMouseUp={(e) => { handleMouseUp(); handleFillEnd(); void e; }}
      onContextMenu={handleContextMenu}
    >
      {/* Pinned top rows — fixed above scroll area */}
        {pinnedTopRows.length > 0 && (
          <FixedRowBand
            rows={pinnedTopRows}
            bandHeight={pinnedTopHeight}
            centerColumns={centerColumns}
            columnResizePreview={gridColumnResizePreview}
            hasLeftPinned={hasLeftPinned}
            hasRightPinned={hasRightPinned}
          leftWidth={leftWidth}
          rightWidth={rightWidth}
            label="pinned-top"
            isCellActive={isCellActive}
            isCellSelected={isCellSelected}
            getSelectionOutline={getSelectionOutline}
            getClipboardOutline={getClipboardOutline}
            clipboardMode={clipboardSelectionMode}
              onCellMouseDown={handleGridCellMouseDown}
              onCellMouseEnter={handleCellMouseEnter}
              getFormulaReferenceColor={getFormulaReferenceColor}
            onNavigate={handleNavigate}
            getCellMergeRenderState={getCellMergeRenderState}
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
                columnResizePreview={gridColumnResizePreview}
                isCellActive={isCellActive}
                isCellSelected={isCellSelected}
                getSelectionOutline={getSelectionOutline}
                getClipboardOutline={getClipboardOutline}
                clipboardMode={clipboardSelectionMode}
                          onCellMouseDown={handleGridCellMouseDown}
                  onCellMouseEnter={handleCellMouseEnter}
                  getFormulaReferenceColor={getFormulaReferenceColor}
                onNavigate={handleNavigate}
                getCellMergeRenderState={getCellMergeRenderState}
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
                    const mergeState = getCellMergeRenderState(rIdx, cId);
                    if (mergeState.isCovered) return null;
                      return (
                        <CellRenderer
                          key={cell.id}
                          cell={cell as Cell<Record<string, CellValue>, unknown>}
                          width={gridColumnResizePreview[cId] ?? virtualCol.size}
                          height={virtualRow.size}
                          translateX={virtualCol.start}
                          mergeSpan={mergeState.mergeSpan}
                          isActive={isCellActive(rIdx, cId)}
                            isSelected={isCellSelected(rIdx, cId)}
                            selectionOutline={getSelectionOutline(
                              rIdx,
                              cId,
                              mergeState.outlineBounds,
                            )}
                            clipboardOutline={getClipboardOutline(
                              rIdx,
                              cId,
                              mergeState.outlineBounds,
                            )}
                            clipboardMode={clipboardSelectionMode}
                            rowSelected={isRowSelected}
                            rowExpanded={row.getIsExpanded()}
                            formulaReferenceColor={getFormulaReferenceColor(rIdx, cId)}
                          onCellMouseDown={handleGridCellMouseDown}
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
                columnResizePreview={gridColumnResizePreview}
                isCellActive={isCellActive}
                isCellSelected={isCellSelected}
                getSelectionOutline={getSelectionOutline}
                getClipboardOutline={getClipboardOutline}
                clipboardMode={clipboardSelectionMode}
                onCellMouseDown={handleGridCellMouseDown}
                onCellMouseEnter={handleCellMouseEnter}
                  getFormulaReferenceColor={getFormulaReferenceColor}
                onNavigate={handleNavigate}
                getCellMergeRenderState={getCellMergeRenderState}
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
            columnResizePreview={gridColumnResizePreview}
            hasLeftPinned={hasLeftPinned}
            hasRightPinned={hasRightPinned}
            leftWidth={leftWidth}
          rightWidth={rightWidth}
            label="pinned-bottom"
            isCellActive={isCellActive}
            isCellSelected={isCellSelected}
            getSelectionOutline={getSelectionOutline}
            getClipboardOutline={getClipboardOutline}
            clipboardMode={clipboardSelectionMode}
            onCellMouseDown={handleGridCellMouseDown}
            onCellMouseEnter={handleCellMouseEnter}
              getFormulaReferenceColor={getFormulaReferenceColor}
            onNavigate={handleNavigate}
            getCellMergeRenderState={getCellMergeRenderState}
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
        leftPinnedCount={leftDataColumns.length}
        centerCount={centerDataColumns.length}
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
  getSelectionOutline: (
    rowIndex: number,
    columnId: string,
    mergeOutline?: MergeOutlineBounds | null,
  ) => CellOutline | null;
  getClipboardOutline: (
    rowIndex: number,
    columnId: string,
    mergeOutline?: MergeOutlineBounds | null,
  ) => CellOutline | null;
  clipboardMode: ClipboardSelectionMode | null;
  onCellMouseDown: (rowIndex: number, columnId: string, shiftKey: boolean) => void;
  onCellMouseEnter: (rowIndex: number, columnId: string) => void;
  getFormulaReferenceColor: (
    rowIndex: number,
    columnId: string,
  ) => string | undefined;
  onNavigate: (fromRow: number, fromColumnId: string, direction: "up" | "down" | "left" | "right") => void;
  getCellMergeRenderState: (rowIndex: number, columnId: string) => CellMergeRenderState;
}

/** Non-virtualized pinned column pane (left or right) */
function PinnedPane({
  rows,
  virtualRows,
  totalHeight,
  paneWidth,
  side,
  columnResizePreview,
  isCellActive,
  isCellSelected,
  getSelectionOutline,
  getClipboardOutline,
  clipboardMode,
  onCellMouseDown,
  onCellMouseEnter,
  getFormulaReferenceColor,
  onNavigate,
  getCellMergeRenderState,
}: {
  rows: Row<Record<string, CellValue>>[];
  virtualRows: { index: number; start: number; size: number }[];
  totalHeight: number;
  paneWidth: number;
  side: "left" | "right";
  columnResizePreview: Record<string, number>;
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
              data-row-index={row.index}
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {cells.map((cell) => {
                const width =
                  columnResizePreview[cell.column.id] ?? cell.column.getSize();
                const translateX = offset;
                offset += width;
              const cId = cell.column.id;
              const rIdx = cell.row.index;
              const mergeState = getCellMergeRenderState(rIdx, cId);
              if (mergeState.isCovered) return null;
                return (
                  <CellRenderer
                    key={cell.id}
                    cell={cell as Cell<Record<string, CellValue>, unknown>}
                      width={width}
                      height={virtualRow.size}
                      translateX={translateX}
                      mergeSpan={mergeState.mergeSpan}
                        isActive={isCellActive(rIdx, cId)}
                        isSelected={isCellSelected(rIdx, cId)}
                        selectionOutline={getSelectionOutline(
                          rIdx,
                          cId,
                          mergeState.outlineBounds,
                        )}
                        clipboardOutline={getClipboardOutline(
                          rIdx,
                          cId,
                          mergeState.outlineBounds,
                        )}
                        clipboardMode={clipboardMode}
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
  columnResizePreview,
  hasLeftPinned,
  hasRightPinned,
  leftWidth,
  rightWidth,
  label,
  isCellActive,
  isCellSelected,
  getSelectionOutline,
  getClipboardOutline,
  clipboardMode,
  onCellMouseDown,
  onCellMouseEnter,
  getFormulaReferenceColor,
  onNavigate,
  getCellMergeRenderState,
}: {
  rows: Row<Record<string, CellValue>>[];
  bandHeight: number;
  centerColumns: { id: string; getSize: () => number }[];
  columnResizePreview: Record<string, number>;
  hasLeftPinned: boolean;
  hasRightPinned: boolean;
  leftWidth: number;
  rightWidth: number;
  label: string;
} & SelectionCallbacks) {
  const centerWidth = centerColumns.reduce(
    (sum, col) => sum + (columnResizePreview[col.id] ?? col.getSize() ?? DEFAULT_COL_WIDTH),
    0,
  );

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
                <div key={row.id} className="relative" data-row-index={row.index} style={{ height: ROW_HEIGHT }}>
                  {cells.map((cell) => {
                    const width =
                      columnResizePreview[cell.column.id] ?? cell.column.getSize();
                    const translateX = offset;
                    offset += width;
                  const cId = cell.column.id;
                  const rIdx = cell.row.index;
                  const mergeState = getCellMergeRenderState(rIdx, cId);
                  if (mergeState.isCovered) return null;
                    return (
                      <CellRenderer
                        key={cell.id}
                        cell={cell as Cell<Record<string, CellValue>, unknown>}
                          width={width}
                          height={ROW_HEIGHT}
                          translateX={translateX}
                          mergeSpan={mergeState.mergeSpan}
                            isActive={isCellActive(rIdx, cId)}
                            isSelected={isCellSelected(rIdx, cId)}
                            selectionOutline={getSelectionOutline(
                              rIdx,
                              cId,
                              mergeState.outlineBounds,
                            )}
                            clipboardOutline={getClipboardOutline(
                              rIdx,
                              cId,
                              mergeState.outlineBounds,
                            )}
                            clipboardMode={clipboardMode}
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
              <div key={row.id} className="relative" data-row-index={row.index} style={{ height: ROW_HEIGHT }}>
                {centerCells.map((cell) => {
                  const width =
                    columnResizePreview[cell.column.id] ?? cell.column.getSize();
                  const translateX = offset;
                  offset += width;
                const cId = cell.column.id;
                const rIdx = cell.row.index;
                const mergeState = getCellMergeRenderState(rIdx, cId);
                if (mergeState.isCovered) return null;
                    return (
                      <CellRenderer
                        key={cell.id}
                        cell={cell as Cell<Record<string, CellValue>, unknown>}
                          width={width}
                          height={ROW_HEIGHT}
                          translateX={translateX}
                          mergeSpan={mergeState.mergeSpan}
                            isActive={isCellActive(rIdx, cId)}
                            isSelected={isCellSelected(rIdx, cId)}
                            selectionOutline={getSelectionOutline(
                              rIdx,
                              cId,
                              mergeState.outlineBounds,
                            )}
                            clipboardOutline={getClipboardOutline(
                              rIdx,
                              cId,
                              mergeState.outlineBounds,
                            )}
                            clipboardMode={clipboardMode}
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
                <div key={row.id} className="relative" data-row-index={row.index} style={{ height: ROW_HEIGHT }}>
                  {cells.map((cell) => {
                    const width =
                      columnResizePreview[cell.column.id] ?? cell.column.getSize();
                    const translateX = offset;
                    offset += width;
                  const cId = cell.column.id;
                  const rIdx = cell.row.index;
                  const mergeState = getCellMergeRenderState(rIdx, cId);
                  if (mergeState.isCovered) return null;
                    return (
                      <CellRenderer
                        key={cell.id}
                        cell={cell as Cell<Record<string, CellValue>, unknown>}
                          width={width}
                          height={ROW_HEIGHT}
                          translateX={translateX}
                          mergeSpan={mergeState.mergeSpan}
                            isActive={isCellActive(rIdx, cId)}
                            isSelected={isCellSelected(rIdx, cId)}
                            selectionOutline={getSelectionOutline(
                              rIdx,
                              cId,
                              mergeState.outlineBounds,
                            )}
                            clipboardOutline={getClipboardOutline(
                              rIdx,
                              cId,
                              mergeState.outlineBounds,
                            )}
                            clipboardMode={clipboardMode}
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
