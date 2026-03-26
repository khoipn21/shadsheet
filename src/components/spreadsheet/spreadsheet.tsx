import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from "react";
import { createColumnHelper, type FilterFn, type Table } from "@tanstack/react-table";
import type { HyperFormula } from "hyperformula";
import type { StoreApi } from "zustand";
import { SpreadsheetProvider, SpreadsheetContext, TableContext } from "./spreadsheet-provider";
import { SpreadsheetGrid, type SpreadsheetGridApi } from "./spreadsheet-grid";
import { FormulaBar } from "./formula-bar";
import { Toolbar } from "./toolbar";
import { GlobalSearchFilter } from "./global-search-filter";
import { useHyperFormula } from "@/hooks/use-hyperformula";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { cn } from "@/lib/utils";
import {
  normalizeColumnFilterValue,
  spreadsheetColumnFilterFn,
} from "@/utils/column-filter-utils";
import { exportToCSV, exportToXLSX } from "@/utils/export-utils";
import { readSheetRows, replaceSheetData } from "@/utils/formula-utils";
import type {
  CellValue,
  SpreadsheetColumnConfig,
  SpreadsheetExportFormat,
  SpreadsheetFilterState,
  SpreadsheetProps,
  SpreadsheetRef,
  SpreadsheetRowData,
  SpreadsheetSelectionState,
  SpreadsheetSortDescriptor,
  SpreadsheetStore,
} from "@/types/spreadsheet-types";

function getExportFileName(baseName: string | undefined, format: SpreadsheetExportFormat) {
  const sanitizedBase = (baseName ?? "spreadsheet").replace(/\.(csv|xlsx)$/i, "");
  return `${sanitizedBase}.${format}`;
}

function SpreadsheetBridge<TData extends SpreadsheetRowData>({
  onSelectionChange,
  onSort,
  onFilter,
  storeRef,
  tableRef,
  hfRef,
}: {
  onSelectionChange?: (selection: SpreadsheetSelectionState<TData>) => void;
  onSort?: (sorting: SpreadsheetSortDescriptor[]) => void;
  onFilter?: (filters: SpreadsheetFilterState) => void;
  storeRef: React.MutableRefObject<StoreApi<SpreadsheetStore> | null>;
  tableRef: React.MutableRefObject<Table<TData> | null>;
  hfRef: React.MutableRefObject<HyperFormula | null>;
}) {
  const store = useContext(SpreadsheetContext);
  const table = useContext(TableContext) as Table<TData> | null;
  const hf = useHyperFormula();
  const activeCell = useSpreadsheetStore((state) => state.activeCell);
  const selectionRange = useSpreadsheetStore((state) => state.selectionRange);
  const rowSelection = useSpreadsheetStore((state) => state.rowSelection);
  const sorting = useSpreadsheetStore((state) => state.sorting);
  const columnFilters = useSpreadsheetStore((state) => state.columnFilters);
  const globalFilter = useSpreadsheetStore((state) => state.globalFilter);

  useEffect(() => {
    storeRef.current = store;
    tableRef.current = table;
    hfRef.current = hf;
  }, [hf, store, storeRef, table, tableRef, hfRef]);

  useEffect(() => {
    if (!onSelectionChange || !table) return;
    const timeoutId = window.setTimeout(() => {
      onSelectionChange({
        activeCell,
        selectionRange,
        selectedRows: table.getSelectedRowModel().flatRows.map((row) => row.original),
        selectedRowIds: Object.keys(rowSelection),
      });
    }, 60);
    return () => window.clearTimeout(timeoutId);
  }, [activeCell, onSelectionChange, rowSelection, selectionRange, table]);

  useEffect(() => {
    onSort?.(sorting.map(({ id, desc }) => ({ id, desc })));
  }, [onSort, sorting]);

  useEffect(() => {
      onFilter?.({
        global: globalFilter,
        columns: columnFilters.map(({ id, value }) => ({
          id,
          value: normalizeColumnFilterValue(value),
        })),
      });
    }, [columnFilters, globalFilter, onFilter]);

  return null;
}

function SpreadsheetInner<TData extends SpreadsheetRowData>(
  {
    data,
    columns,
    getRowId,
    getSubRows,
    sortable = true,
    filterable = true,
    editable = true,
    resizableColumns = true,
    reorderableColumns = true,
    formulasEnabled = true,
    showToolbar = true,
    showFormulaBar = true,
    globalSearchable = true,
    rowSelection = "multi",
    onSelectionChange,
    onCellChange,
    onBeforeCellEdit,
    onSort,
    onFilter,
    onExport,
    height = "100%",
    pinnedColumns,
    defaultColumnWidth = 120,
    exportFileName,
    grouping,
    className,
    theme = "light",
  }: SpreadsheetProps<TData>,
  ref: Ref<SpreadsheetRef<TData>>,
) {
  const [internalData, setInternalData] = useState(data);
  const helper = useMemo(() => createColumnHelper<TData>(), []);
  const storeRef = useRef<StoreApi<SpreadsheetStore> | null>(null);
  const tableRef = useRef<Table<TData> | null>(null);
  const hfRef = useRef<HyperFormula | null>(null);
  const gridApiRef = useRef<SpreadsheetGridApi | null>(null);

  const resolvedColumns = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        width: column.width ?? defaultColumnWidth,
        sortable: sortable && column.sortable !== false,
        filterable: filterable && column.filterable !== false,
        editable: editable ? (column.editable ?? true) : false,
        pinned: pinnedColumns?.left?.includes(column.id as string)
          ? "left"
          : pinnedColumns?.right?.includes(column.id as string)
            ? "right"
            : (column.pinned ?? false),
      })),
    [columns, defaultColumnWidth, editable, filterable, pinnedColumns, sortable],
  );

  const tableColumns = useMemo(
    () =>
      resolvedColumns.map((column) =>
          helper.accessor((row) => row[column.id as keyof TData] as CellValue, {
            id: column.id as string,
            header: column.header,
            size: column.width,
            enableSorting: column.sortable !== false,
            enableColumnFilter: column.filterable !== false,
            filterFn: spreadsheetColumnFilterFn as unknown as FilterFn<TData>,
            enableResizing: resizableColumns,
          }),
      ),
    [helper, resolvedColumns, resizableColumns],
  );

  useEffect(() => {
    setInternalData(data);
    if (!hfRef.current) return;
    replaceSheetData(
      hfRef.current,
      data,
      resolvedColumns as SpreadsheetColumnConfig[],
    );
    storeRef.current?.getState().incrementRenderTrigger();
  }, [data, resolvedColumns]);

  const syncFromFormulaEngine = useCallback(() => {
    if (!hfRef.current) return;
    setInternalData(
      readSheetRows<TData>(
        hfRef.current,
        resolvedColumns as SpreadsheetColumnConfig<TData>[],
      ),
    );
  }, [resolvedColumns]);

  const handleDataChange = useCallback(
    (rowIndex: number, columnId: string, oldValue: CellValue, newValue: CellValue) => {
      const accepted =
        onCellChange?.({ rowIndex, columnId, oldValue, newValue, rowData: internalData[rowIndex] }) !== false;
      if (!accepted) return false;

      setInternalData((previous) => {
        if (!previous[rowIndex]) return previous;
        const next = [...previous];
        next[rowIndex] = { ...next[rowIndex], [columnId]: newValue };
        return next;
      });

      return true;
    },
    [internalData, onCellChange],
  );

  const runExport = useCallback(
    async (format: SpreadsheetExportFormat) => {
      if (!hfRef.current || !storeRef.current) return;
      const visibility = storeRef.current.getState().columnVisibility;
      const filename = getExportFileName(exportFileName, format);
      if (format === "csv") {
        exportToCSV(
          hfRef.current,
          0,
          resolvedColumns as SpreadsheetColumnConfig[],
          visibility,
          filename,
        );
      } else {
        await exportToXLSX(
          hfRef.current,
          0,
          resolvedColumns as SpreadsheetColumnConfig[],
          visibility,
          filename,
        );
      }
      onExport?.(format);
    },
    [exportFileName, onExport, resolvedColumns],
  );

  useImperativeHandle(ref, () => ({
    focus: () => gridApiRef.current?.focus(),
    scrollToCell: (rowIndex, column) => gridApiRef.current?.scrollToCell(rowIndex, column),
    getSelectedData: () => {
      const state = storeRef.current?.getState();
      if (!state || !hfRef.current) return [];
      const visibleIds = tableRef.current?.getVisibleLeafColumns().map((column) => column.id).filter((id) => id !== "_row_number") ?? [];
      const selection = state.selectionRange ?? (state.activeCell ? { start: state.activeCell, end: state.activeCell } : null);
      if (!selection) return [];
      const startCol = visibleIds.indexOf(selection.start.columnId);
      const endCol = visibleIds.indexOf(selection.end.columnId);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      const minRow = Math.min(selection.start.rowIndex, selection.end.rowIndex);
      const maxRow = Math.max(selection.start.rowIndex, selection.end.rowIndex);

      return Array.from({ length: maxRow - minRow + 1 }, (_, rowOffset) =>
        Array.from({ length: maxCol - minCol + 1 }, (_, colOffset) => {
          const columnId = visibleIds[minCol + colOffset];
          const columnIndex = resolvedColumns.findIndex((column) => column.id === columnId);
          return hfRef.current?.getCellValue({ sheet: 0, row: minRow + rowOffset, col: columnIndex }) as CellValue;
        }),
      );
    },
    getData: () => internalData,
    setData: (nextData) => {
      setInternalData(nextData);
      if (!hfRef.current) return;
      replaceSheetData(
        hfRef.current,
        nextData,
        resolvedColumns as SpreadsheetColumnConfig[],
      );
      storeRef.current?.getState().incrementRenderTrigger();
    },
    exportToCSV: () => void runExport("csv"),
    exportToXLSX: () => runExport("xlsx"),
    undo: () => {
      if (!hfRef.current?.isThereSomethingToUndo()) return;
      hfRef.current.undo();
      storeRef.current?.getState().incrementRenderTrigger();
      syncFromFormulaEngine();
    },
    redo: () => {
      if (!hfRef.current?.isThereSomethingToRedo()) return;
      hfRef.current.redo();
      storeRef.current?.getState().incrementRenderTrigger();
      syncFromFormulaEngine();
    },
  }), [internalData, resolvedColumns, runExport, syncFromFormulaEngine]);

  return (
    <div className={cn("flex flex-col gap-3", theme === "dark" && "dark", className)} style={{ height }}>
      <SpreadsheetProvider
        data={internalData}
        columns={tableColumns}
        columnConfigs={resolvedColumns as SpreadsheetColumnConfig<TData>[]}
        getRowId={getRowId}
        getSubRows={getSubRows}
        onDataChange={handleDataChange}
        featureFlags={{
          editable,
          resizableColumns,
          reorderableColumns,
          formulasEnabled,
          onBeforeCellEdit: onBeforeCellEdit
            ? (cell, rowData) => onBeforeCellEdit(cell, rowData as TData)
            : undefined,
        }}
        initialColumnPinning={pinnedColumns}
        initialGrouping={grouping}
        rowSelectionEnabled={rowSelection !== "none"}
        rowSelectionMode={rowSelection === "single" ? "single" : "multi"}
      >
        <SpreadsheetBridge
          onSelectionChange={onSelectionChange}
          onSort={onSort}
          onFilter={onFilter}
          storeRef={storeRef}
          tableRef={tableRef}
          hfRef={hfRef}
        />
        {showToolbar && (
          <Toolbar
            columns={resolvedColumns as SpreadsheetColumnConfig[]}
            exportFileName={exportFileName}
            onExport={onExport}
          />
        )}
        {showFormulaBar && formulasEnabled && <FormulaBar />}
        {globalSearchable && filterable && <div className="flex items-center gap-2"><GlobalSearchFilter /></div>}
        <SpreadsheetGrid apiRef={gridApiRef} className="flex-1 min-h-0" />
      </SpreadsheetProvider>
    </div>
  );
}

export const Spreadsheet = forwardRef(SpreadsheetInner) as <
  TData extends SpreadsheetRowData = SpreadsheetRowData,
>(
  props: SpreadsheetProps<TData> & { ref?: Ref<SpreadsheetRef<TData>> },
) => ReactElement;
