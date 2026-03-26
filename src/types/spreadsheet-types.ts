import type {
  ColumnFiltersState,
  ColumnPinningState,
  ExpandedState,
  GroupingState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import type { ZodSchema } from "zod";

/** Primitive cell value types. */
export type CellValue = string | number | boolean | null | Date;

/** Spreadsheet row shape exposed by the public component API. */
export type SpreadsheetRowData = Record<string, CellValue>;

/** Column data types — determines which editor component is rendered. */
export type ColumnType = "text" | "number" | "date" | "select" | "checkbox";

/** Validation result from Zod schema. */
export interface ValidationResult {
  success: boolean;
  error?: string;
}

/** Props shared by all cell editor components. */
export interface CellEditorProps {
  value: CellValue;
  onChange: (value: CellValue) => void;
  onCommit: () => void;
  onCancel: () => void;
  columnConfig: SpreadsheetColumnConfig;
}

/** Option for select-type columns. */
export interface SelectOption {
  label: string;
  value: string;
}

/** Cell address in the grid. */
export interface CellAddress {
  rowIndex: number;
  columnId: string;
}

/** Selection range (rectangular block). */
export interface SelectionRange {
  start: CellAddress;
  end: CellAddress;
}

/** Pin position for a column. */
export type PinPosition = "left" | "right" | false;

/** Row pinning — IDs pinned to top or bottom. */
export interface RowPinningState {
  top: string[];
  bottom: string[];
}

/** Row selection mode. */
export type RowSelectionMode = "single" | "multi";

/** Public row selection mode — allows row selection to be disabled entirely. */
export type SpreadsheetRowSelectionMode = RowSelectionMode | "none";

/** Aggregation type for grouped columns. */
export type AggregationType = "sum" | "count" | "avg";

/** Cell formatting (UI-only, not stored in HyperFormula). */
export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bgColor?: string;
  align?: "left" | "center" | "right";
}

/** Conditional formatting rule. */
export interface ConditionalFormatRule {
  range: SelectionRange;
  condition: (value: CellValue) => boolean;
  style: CellFormat;
}

/** Text alignment type. */
export type TextAlignment = "left" | "center" | "right";

/** Context menu position state. */
export interface ContextMenuState {
  x: number;
  y: number;
  cell: CellAddress;
}

/** Public column configuration for the spreadsheet component. */
export interface SpreadsheetColumnConfig<
  TData extends SpreadsheetRowData = SpreadsheetRowData,
> {
  id: Extract<keyof TData, string> | string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  pinned?: PinPosition;
  sortable?: boolean;
  filterable?: boolean;
  type?: ColumnType;
  editable?: boolean | ((row: TData) => boolean);
  validation?: ZodSchema;
  options?: SelectOption[];
}

/** Short public alias for column config exports. */
export type ColumnConfig<TData extends SpreadsheetRowData = SpreadsheetRowData> =
  SpreadsheetColumnConfig<TData>;

/** Callback payload for cell edit commits. */
export interface SpreadsheetCellChange<
  TData extends SpreadsheetRowData = SpreadsheetRowData,
> {
  rowIndex: number;
  columnId: string;
  oldValue: CellValue;
  newValue: CellValue;
  rowData: TData | undefined;
}

/** Public selection payload emitted by the top-level component. */
export interface SpreadsheetSelectionState<
  TData extends SpreadsheetRowData = SpreadsheetRowData,
> {
  activeCell: CellAddress | null;
  selectionRange: SelectionRange | null;
  selectedRows: TData[];
  selectedRowIds: string[];
}

/** Public sort descriptor. */
export interface SpreadsheetSortDescriptor {
  id: string;
  desc: boolean;
}

/** Freeform column filter input: plain search plus expression language. */
export interface SpreadsheetColumnFilterValue {
  search: string;
  expression: string;
}

/** Public column filter descriptor. */
export interface SpreadsheetFilterDescriptor {
  id: string;
  value: SpreadsheetColumnFilterValue;
}

/** Public filter payload. */
export interface SpreadsheetFilterState {
  global: string;
  columns: SpreadsheetFilterDescriptor[];
}

/** Export formats supported by the component API. */
export type SpreadsheetExportFormat = "csv" | "xlsx";

/** Runtime feature flags used by internal components. */
export interface SpreadsheetFeatureFlags {
  editable: boolean;
  resizableColumns: boolean;
  formulasEnabled: boolean;
  onBeforeCellEdit?: (
    cell: CellAddress,
    rowData: SpreadsheetRowData,
  ) => boolean;
}

/** Imperative handle exposed by the top-level Spreadsheet component. */
export interface SpreadsheetRef<
  TData extends SpreadsheetRowData = SpreadsheetRowData,
> {
  /** Focus the grid container so keyboard shortcuts work immediately. */
  focus: () => void;
  /** Scroll the viewport to a target cell by current column index or column id. */
  scrollToCell: (rowIndex: number, column: number | string) => void;
  /** Read the active selection as a rectangular 2D array. */
  getSelectedData: () => CellValue[][];
  /** Read the current row data snapshot. */
  getData: () => TData[];
  /** Replace the current dataset and rebuild the HyperFormula sheet. */
  setData: (data: TData[]) => void;
  /** Export the visible grid to CSV. */
  exportToCSV: () => void;
  /** Export the visible grid to XLSX. */
  exportToXLSX: () => Promise<void>;
  /** Trigger a HyperFormula undo operation when available. */
  undo: () => void;
  /** Trigger a HyperFormula redo operation when available. */
  redo: () => void;
}

/** Props for the public Spreadsheet wrapper component. */
export interface SpreadsheetProps<
  TData extends SpreadsheetRowData = SpreadsheetRowData,
> {
  data: TData[];
  columns: SpreadsheetColumnConfig<TData>[];
  getRowId?: (row: TData, index: number) => string;
  getSubRows?: (row: TData) => TData[] | undefined;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  resizableColumns?: boolean;
  formulasEnabled?: boolean;
  showToolbar?: boolean;
  showFormulaBar?: boolean;
  globalSearchable?: boolean;
  rowSelection?: SpreadsheetRowSelectionMode;
  onSelectionChange?: (
    selection: SpreadsheetSelectionState<TData>,
  ) => void;
  onCellChange?: (
    change: SpreadsheetCellChange<TData>,
  ) => void | boolean;
  onBeforeCellEdit?: (cell: CellAddress, row: TData) => boolean;
  onSort?: (sorting: SpreadsheetSortDescriptor[]) => void;
  onFilter?: (filters: SpreadsheetFilterState) => void;
  onExport?: (format: SpreadsheetExportFormat) => void;
  height?: number | string;
  pinnedColumns?: { left?: string[]; right?: string[] };
  defaultColumnWidth?: number;
  exportFileName?: string;
  grouping?: string[];
  className?: string;
  theme?: "light" | "dark";
}

/** UI state managed by Zustand — HyperFormula owns cell data. */
export interface SpreadsheetUIState {
  columns: SpreadsheetColumnConfig[];
  activeCell: CellAddress | null;
  selectionRange: SelectionRange | null;
  editingCell: CellAddress | null;
  editValue: CellValue;
  formulaPreviewValue: string | null;
  validationError: string | null;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  columnOrder: string[];
  columnResizePreview: Record<string, number>;
  columnPinning: ColumnPinningState;
  columnVisibility: VisibilityState;
  rowSelection: RowSelectionState;
  rowSelectionMode: RowSelectionMode;
  lastSelectedRowId: string | null;
  expanded: ExpandedState;
  rowPinning: RowPinningState;
  grouping: GroupingState;
  renderTrigger: number;
  cellFormats: Record<string, CellFormat>;
  contextMenu: ContextMenuState | null;
}

/** Actions for the Zustand store. */
export interface SpreadsheetUIActions {
  setActiveCell: (cell: CellAddress | null) => void;
  setSelection: (range: SelectionRange | null) => void;
  setEditingCell: (cell: CellAddress | null) => void;
  setEditValue: (value: CellValue) => void;
  setFormulaPreviewValue: (value: string | null) => void;
  setValidationError: (error: string | null) => void;
  startEditing: (cell: CellAddress, overwrite?: boolean) => void;
  cancelEdit: () => void;
  setSorting: (sorting: SortingState) => void;
  setColumnFilters: (filters: ColumnFiltersState) => void;
  setGlobalFilter: (filter: string) => void;
  setColumns: (columns: SpreadsheetColumnConfig[]) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnResizePreview: (columnId: string, width: number | null) => void;
  setColumnPinning: (pinning: ColumnPinningState) => void;
  setColumnVisibility: (visibility: VisibilityState) => void;
  pinColumn: (columnId: string, position: PinPosition) => void;
  toggleColumnVisibility: (columnId: string) => void;
  updateColumnWidth: (columnId: string, width: number) => void;
  setRowSelection: (selection: RowSelectionState) => void;
  setRowSelectionMode: (mode: RowSelectionMode) => void;
  setLastSelectedRowId: (id: string | null) => void;
  setExpanded: (expanded: ExpandedState) => void;
  toggleRowExpanded: (rowId: string) => void;
  setRowPinning: (pinning: RowPinningState) => void;
  pinRow: (rowId: string, position: "top" | "bottom" | false) => void;
  setGrouping: (grouping: GroupingState) => void;
  incrementRenderTrigger: () => void;
  setCellFormat: (key: string, format: CellFormat) => void;
  setCellFormats: (formats: Record<string, CellFormat>) => void;
  toggleBold: (keys: string[]) => void;
  toggleItalic: (keys: string[]) => void;
  setColor: (keys: string[], color: string) => void;
  setBgColor: (keys: string[], bgColor: string) => void;
  setTextAlign: (keys: string[], align: TextAlignment) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  shiftCellFormatKeys: (rowIndex: number, direction: "up" | "down") => void;
  removeCellFormatRow: (rowIndex: number) => void;
}

export type SpreadsheetStore = SpreadsheetUIState & SpreadsheetUIActions;

/** TanStack Table meta used by internal cell, keyboard, and toolbar flows. */
export interface SpreadsheetTableMeta {
  updateData: (rowIndex: number, columnId: string, value: CellValue) => boolean;
  getColumnConfig: (columnId: string) => SpreadsheetColumnConfig | undefined;
  featureFlags: SpreadsheetFeatureFlags;
}
