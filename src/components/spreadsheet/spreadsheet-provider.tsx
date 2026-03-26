/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useRef,
  useMemo,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { StoreApi } from "zustand";
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Table,
} from "@tanstack/react-table";
import type { HyperFormula } from "hyperformula";
import { createSpreadsheetStore } from "@/stores/spreadsheet-store";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { createHyperFormulaInstance } from "@/utils/formula-utils";
import { createRowSelectionColumn } from "./row-numbers";
import type {
  CellValue,
  RowSelectionMode,
  SpreadsheetColumnConfig,
  SpreadsheetFeatureFlags,
  SpreadsheetRowData,
  SpreadsheetStore,
  SpreadsheetTableMeta,
} from "@/types/spreadsheet-types";

/** Zustand store context — null default so hook guard catches missing provider. */
export const SpreadsheetContext = createContext<StoreApi<SpreadsheetStore> | null>(null);

/** TanStack Table instance context. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TableContext = createContext<Table<any> | null>(null);

/** HyperFormula instance context (Phase 6). */
export const HyperFormulaContext = createContext<HyperFormula | null>(null);

interface SpreadsheetProviderProps<TData extends SpreadsheetRowData> {
  data: TData[];
  columns: ColumnDef<TData, CellValue>[];
  columnConfigs?: SpreadsheetColumnConfig<TData>[];
  getRowId?: (row: TData, index: number) => string;
  getSubRows?: (row: TData) => TData[] | undefined;
  onDataChange?: (
    rowIndex: number,
    columnId: string,
    oldValue: CellValue,
    newValue: CellValue,
  ) => void | boolean;
  onFormulaSyncRequest?: () => void;
  featureFlags?: SpreadsheetFeatureFlags;
  initialColumnPinning?: { left?: string[]; right?: string[] };
  initialGrouping?: string[];
  rowSelectionEnabled?: boolean;
  rowSelectionMode?: RowSelectionMode;
  children: ReactNode;
}

const DEFAULT_FEATURE_FLAGS: SpreadsheetFeatureFlags = {
  editable: true,
  resizableColumns: true,
  formulasEnabled: true,
  mergeVirtualized: false,
};

export function SpreadsheetProvider<TData extends SpreadsheetRowData>({
  data,
  columns,
  columnConfigs = [],
  getRowId,
  getSubRows,
  onDataChange,
  onFormulaSyncRequest,
  featureFlags = DEFAULT_FEATURE_FLAGS,
  initialColumnPinning,
  initialGrouping = [],
  rowSelectionEnabled = true,
  rowSelectionMode = "multi",
  children,
}: SpreadsheetProviderProps<TData>) {
  const storeRef = useRef<StoreApi<SpreadsheetStore> | null>(null);

  const resolvedPinning = useMemo(
    () => ({
      left: [...(initialColumnPinning?.left ?? [])],
      right: [...(initialColumnPinning?.right ?? [])],
    }),
    [initialColumnPinning],
  );

  if (storeRef.current === null) {
    storeRef.current = createSpreadsheetStore(
      columnConfigs as SpreadsheetColumnConfig[],
    );
    storeRef.current.setState({
      columnPinning: resolvedPinning,
      grouping: [...initialGrouping],
      rowSelectionMode,
    });
  }

  useEffect(() => {
    storeRef.current?.getState().setColumns(
      columnConfigs as SpreadsheetColumnConfig[],
    );
  }, [columnConfigs]);

  useEffect(() => {
    storeRef.current?.setState({
      columnPinning: resolvedPinning,
      grouping: [...initialGrouping],
      rowSelectionMode,
    });
  }, [initialGrouping, resolvedPinning, rowSelectionMode]);

  const [hfInstance, setHfInstance] = useState<HyperFormula | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    createHyperFormulaInstance(
      data,
      columnConfigs as SpreadsheetColumnConfig[],
    ).then(setHfInstance);
    // Only initialize once on mount — cell edits sync via direct HF mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SpreadsheetContext.Provider value={storeRef.current}>
      <HyperFormulaContext.Provider value={hfInstance}>
        <TableProvider
          data={data}
          columns={columns}
          columnConfigs={columnConfigs}
          getRowId={getRowId}
          getSubRows={getSubRows}
            onDataChange={onDataChange}
            onFormulaSyncRequest={onFormulaSyncRequest}
            featureFlags={featureFlags}
          rowSelectionEnabled={rowSelectionEnabled}
          rowSelectionMode={rowSelectionMode}
        >
          {children}
        </TableProvider>
      </HyperFormulaContext.Provider>
    </SpreadsheetContext.Provider>
  );
}

/** Inner component that has access to the Zustand store for wiring TanStack Table. */
function TableProvider<TData extends SpreadsheetRowData>({
  data,
  columns,
  columnConfigs,
  getRowId,
  getSubRows,
  onDataChange,
  onFormulaSyncRequest,
  featureFlags,
  rowSelectionEnabled,
  rowSelectionMode,
  children,
}: {
  data: TData[];
  columns: ColumnDef<TData, CellValue>[];
  columnConfigs: SpreadsheetColumnConfig<TData>[];
  getRowId?: (row: TData, index: number) => string;
  getSubRows?: (row: TData) => TData[] | undefined;
  onDataChange?: (
    rowIndex: number,
    columnId: string,
    oldValue: CellValue,
    newValue: CellValue,
  ) => void | boolean;
  onFormulaSyncRequest?: () => void;
  featureFlags: SpreadsheetFeatureFlags;
  rowSelectionEnabled: boolean;
  rowSelectionMode: RowSelectionMode;
  children: ReactNode;
}) {
  const sorting = useSpreadsheetStore((state) => state.sorting);
  const setSorting = useSpreadsheetStore((state) => state.setSorting);
  const columnFilters = useSpreadsheetStore((state) => state.columnFilters);
  const setColumnFilters = useSpreadsheetStore((state) => state.setColumnFilters);
  const globalFilter = useSpreadsheetStore((state) => state.globalFilter);
  const setGlobalFilter = useSpreadsheetStore((state) => state.setGlobalFilter);
  const columnOrder = useSpreadsheetStore((state) => state.columnOrder);
  const setColumnOrder = useSpreadsheetStore((state) => state.setColumnOrder);
  const columnPinning = useSpreadsheetStore((state) => state.columnPinning);
  const setColumnPinning = useSpreadsheetStore((state) => state.setColumnPinning);
  const columnVisibility = useSpreadsheetStore((state) => state.columnVisibility);
  const setColumnVisibility = useSpreadsheetStore(
    (state) => state.setColumnVisibility,
  );
  const rowSelection = useSpreadsheetStore((state) => state.rowSelection);
  const setRowSelection = useSpreadsheetStore((state) => state.setRowSelection);
  const expanded = useSpreadsheetStore((state) => state.expanded);
  const setExpanded = useSpreadsheetStore((state) => state.setExpanded);
  const grouping = useSpreadsheetStore((state) => state.grouping);
  const setGrouping = useSpreadsheetStore((state) => state.setGrouping);

  const allColumns = useMemo(
    () =>
      [
        createRowSelectionColumn(rowSelectionEnabled) as ColumnDef<TData, CellValue>,
        ...columns,
      ],
    [columns, rowSelectionEnabled],
  );

  const getColumnConfig = useCallback(
    (columnId: string) => columnConfigs.find((column) => column.id === columnId),
    [columnConfigs],
  );

  const meta: SpreadsheetTableMeta = useMemo(
    () => ({
      updateData: (rowIndex: number, columnId: string, value: CellValue) => {
        const row = data[rowIndex];
        const oldValue = (row?.[columnId] ?? null) as CellValue;
        return onDataChange?.(rowIndex, columnId, oldValue, value) !== false;
      },
        getColumnConfig: (columnId) =>
          getColumnConfig(columnId) as SpreadsheetColumnConfig | undefined,
        syncFromFormulaEngine: onFormulaSyncRequest,
        featureFlags,
      }),
      [data, featureFlags, getColumnConfig, onDataChange, onFormulaSyncRequest],
    );

  const table = useReactTable({
    data,
    columns: allColumns,
    meta,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnOrder,
      columnPinning,
      columnVisibility,
      rowSelection,
      expanded,
      grouping,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
    },
    onColumnFiltersChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(next);
    },
    onGlobalFilterChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(globalFilter) : updater;
      setGlobalFilter(next);
    },
    onColumnOrderChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnOrder) : updater;
      setColumnOrder(next);
    },
    onColumnPinningChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnPinning) : updater;
      setColumnPinning(next);
    },
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(next);
    },
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
    },
    onExpandedChange: (updater) => {
      const next = typeof updater === "function" ? updater(expanded) : updater;
      setExpanded(next);
    },
    onGroupingChange: (updater) => {
      const next = typeof updater === "function" ? updater(grouping) : updater;
      setGrouping(next);
    },
    getRowId: getRowId
      ? (originalRow, index) => getRowId(originalRow, index)
      : undefined,
    getSubRows: getSubRows as ((row: TData) => TData[]) | undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    enableRowSelection: rowSelectionEnabled,
    enableMultiRowSelection:
      rowSelectionEnabled && rowSelectionMode === "multi",
    enableExpanding: true,
    enableGrouping: true,
  });

  return <TableContext.Provider value={table}>{children}</TableContext.Provider>;
}
