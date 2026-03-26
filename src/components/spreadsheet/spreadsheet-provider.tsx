import { createContext, useRef, useMemo, useCallback, useState, useEffect, type ReactNode } from "react";
import type { StoreApi } from "zustand";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  type ColumnDef,
  type Table,
} from "@tanstack/react-table";
import type { HyperFormula } from "hyperformula";
import { createSpreadsheetStore } from "@/stores/spreadsheet-store";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { createHyperFormulaInstance } from "@/utils/formula-utils";
import { createRowSelectionColumn } from "./row-numbers";
import type {
  SpreadsheetStore,
  SpreadsheetColumnConfig,
  SpreadsheetTableMeta,
  CellValue,
} from "@/types/spreadsheet-types";

/** Zustand store context — null default so hook guard catches missing provider */
export const SpreadsheetContext = createContext<StoreApi<SpreadsheetStore> | null>(null);

/** TanStack Table instance context */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TableContext = createContext<Table<any> | null>(null);

/** HyperFormula instance context (Phase 6) */
export const HyperFormulaContext = createContext<HyperFormula | null>(null);

interface SpreadsheetProviderProps<TData extends Record<string, CellValue>> {
  data: TData[];
  columns: ColumnDef<TData, CellValue>[];
  columnConfigs?: SpreadsheetColumnConfig[];
  getSubRows?: (row: TData) => TData[] | undefined;
  onDataChange?: (rowIndex: number, columnId: string, value: CellValue) => void;
  children: ReactNode;
}

export function SpreadsheetProvider<TData extends Record<string, CellValue>>({
  data,
  columns,
  columnConfigs = [],
  getSubRows,
  onDataChange,
  children,
}: SpreadsheetProviderProps<TData>) {
  const storeRef = useRef<StoreApi<SpreadsheetStore> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createSpreadsheetStore(columnConfigs);
  }

  // Lazy-load HyperFormula instance
  const [hfInstance, setHfInstance] = useState<HyperFormula | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    createHyperFormulaInstance(data, columnConfigs).then(setHfInstance);
    // Only initialize once on mount — data synced via setCellContents after
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SpreadsheetContext.Provider value={storeRef.current}>
      <HyperFormulaContext.Provider value={hfInstance}>
        <TableProvider
          data={data}
          columns={columns}
          columnConfigs={columnConfigs}
          getSubRows={getSubRows}
          onDataChange={onDataChange}
        >
          {children}
        </TableProvider>
      </HyperFormulaContext.Provider>
    </SpreadsheetContext.Provider>
  );
}

/** Inner component that has access to the Zustand store for wiring TanStack Table */
function TableProvider<TData extends Record<string, CellValue>>({
  data,
  columns,
  columnConfigs,
  getSubRows,
  onDataChange,
  children,
}: {
  data: TData[];
  columns: ColumnDef<TData, CellValue>[];
  columnConfigs: SpreadsheetColumnConfig[];
  getSubRows?: (row: TData) => TData[] | undefined;
  onDataChange?: (rowIndex: number, columnId: string, value: CellValue) => void;
  children: ReactNode;
}) {
  const sorting = useSpreadsheetStore((s) => s.sorting);
  const setSorting = useSpreadsheetStore((s) => s.setSorting);
  const columnFilters = useSpreadsheetStore((s) => s.columnFilters);
  const setColumnFilters = useSpreadsheetStore((s) => s.setColumnFilters);
  const globalFilter = useSpreadsheetStore((s) => s.globalFilter);
  const setGlobalFilter = useSpreadsheetStore((s) => s.setGlobalFilter);
  const columnOrder = useSpreadsheetStore((s) => s.columnOrder);
  const setColumnOrder = useSpreadsheetStore((s) => s.setColumnOrder);
  const columnPinning = useSpreadsheetStore((s) => s.columnPinning);
  const setColumnPinning = useSpreadsheetStore((s) => s.setColumnPinning);
  const columnVisibility = useSpreadsheetStore((s) => s.columnVisibility);
  const setColumnVisibility = useSpreadsheetStore((s) => s.setColumnVisibility);
  // Row features (Phase 3)
  const rowSelection = useSpreadsheetStore((s) => s.rowSelection);
  const setRowSelection = useSpreadsheetStore((s) => s.setRowSelection);
  const rowSelectionMode = useSpreadsheetStore((s) => s.rowSelectionMode);
  const expanded = useSpreadsheetStore((s) => s.expanded);
  const setExpanded = useSpreadsheetStore((s) => s.setExpanded);
  const grouping = useSpreadsheetStore((s) => s.grouping);
  const setGrouping = useSpreadsheetStore((s) => s.setGrouping);

  // Prepend row-number/selection column
  const allColumns = useMemo(
    () => [createRowSelectionColumn() as ColumnDef<TData, CellValue>, ...columns],
    [columns],
  );

  // Column config lookup for editors
  const getColumnConfig = useCallback(
    (columnId: string) => columnConfigs.find((c) => c.id === columnId),
    [columnConfigs],
  );

  const meta: SpreadsheetTableMeta = useMemo(
    () => ({
      updateData: (rowIndex: number, columnId: string, value: CellValue) => {
        onDataChange?.(rowIndex, columnId, value);
      },
      getColumnConfig,
    }),
    [onDataChange, getColumnConfig],
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
      const next = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(next);
    },
    onGlobalFilterChange: (updater) => {
      const next = typeof updater === "function" ? updater(globalFilter) : updater;
      setGlobalFilter(next);
    },
    onColumnOrderChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnOrder) : updater;
      setColumnOrder(next);
    },
    onColumnPinningChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnPinning) : updater;
      setColumnPinning(next);
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(next);
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
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
    getSubRows: getSubRows as ((row: TData) => TData[]) | undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    enableRowSelection: true,
    enableMultiRowSelection: rowSelectionMode === "multi",
    enableExpanding: true,
    enableGrouping: true,
  });

  return (
    <TableContext.Provider value={table}>
      {children}
    </TableContext.Provider>
  );
}
