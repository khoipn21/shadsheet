import type { ColumnDef, SortingState, ColumnFiltersState, ColumnPinningState, VisibilityState, ExpandedState, RowSelectionState, GroupingState } from "@tanstack/react-table";
import type { ZodSchema } from "zod";

/** Primitive cell value types */
export type CellValue = string | number | boolean | null | Date;

/** Column data types — determines which editor component is rendered */
export type ColumnType = "text" | "number" | "date" | "select" | "checkbox";

/** Validation result from Zod schema */
export interface ValidationResult {
  success: boolean;
  error?: string;
}

/** Props shared by all cell editor components */
export interface CellEditorProps {
  value: CellValue;
  onChange: (value: CellValue) => void;
  onCommit: () => void;
  onCancel: () => void;
  columnConfig: SpreadsheetColumnConfig;
}

/** Option for select-type columns */
export interface SelectOption {
  label: string;
  value: string;
}

/** Cell address in the grid */
export interface CellAddress {
  rowIndex: number;
  columnId: string;
}

/** Selection range (rectangular block) */
export interface SelectionRange {
  start: CellAddress;
  end: CellAddress;
}

/** Pin position for a column */
export type PinPosition = "left" | "right" | false;

/** Row pinning — IDs pinned to top or bottom */
export interface RowPinningState {
  top: string[];
  bottom: string[];
}

/** Row selection mode */
export type RowSelectionMode = "single" | "multi";

/** Aggregation type for grouped columns */
export type AggregationType = "sum" | "count" | "avg";

/** Cell formatting (UI-only, not stored in HyperFormula) */
export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bgColor?: string;
  align?: "left" | "center" | "right";
}

/** Conditional formatting rule */
export interface ConditionalFormatRule {
  range: SelectionRange;
  condition: (value: CellValue) => boolean;
  style: CellFormat;
}

/** Text alignment type */
export type TextAlignment = "left" | "center" | "right";

/** Context menu position state */
export interface ContextMenuState {
  x: number;
  y: number;
  cell: CellAddress;
}

/** Column configuration for the spreadsheet */
export interface SpreadsheetColumnConfig {
  id: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  pinned?: PinPosition;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: "text" | "number" | "date" | "select";
  // Cell editing (Phase 4)
  type?: ColumnType;
  editable?: boolean | ((row: Record<string, CellValue>) => boolean);
  validation?: ZodSchema;
  options?: SelectOption[];
}

/** UI state managed by Zustand — HyperFormula owns cell data (Phase 6) */
export interface SpreadsheetUIState {
  columns: SpreadsheetColumnConfig[];
  activeCell: CellAddress | null;
  selectionRange: SelectionRange | null;
  editingCell: CellAddress | null;
  editValue: CellValue;
  validationError: string | null;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  columnOrder: string[];
  columnPinning: ColumnPinningState;
  columnVisibility: VisibilityState;
  // Row features (Phase 3)
  rowSelection: RowSelectionState;
  rowSelectionMode: RowSelectionMode;
  lastSelectedRowId: string | null;
  expanded: ExpandedState;
  rowPinning: RowPinningState;
  grouping: GroupingState;
  // Formula engine (Phase 6) — renderTrigger incremented to force re-render after HF changes
  renderTrigger: number;
  // Polish (Phase 7) — cell formatting + context menu
  cellFormats: Record<string, CellFormat>;
  contextMenu: ContextMenuState | null;
}

/** Actions for the Zustand store */
export interface SpreadsheetUIActions {
  setActiveCell: (cell: CellAddress | null) => void;
  setSelection: (range: SelectionRange | null) => void;
  setEditingCell: (cell: CellAddress | null) => void;
  setEditValue: (value: CellValue) => void;
  setValidationError: (error: string | null) => void;
  startEditing: (cell: CellAddress, overwrite?: boolean) => void;
  cancelEdit: () => void;
  setSorting: (sorting: SortingState) => void;
  setColumnFilters: (filters: ColumnFiltersState) => void;
  setGlobalFilter: (filter: string) => void;
  setColumns: (columns: SpreadsheetColumnConfig[]) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnPinning: (pinning: ColumnPinningState) => void;
  setColumnVisibility: (visibility: VisibilityState) => void;
  pinColumn: (columnId: string, position: PinPosition) => void;
  toggleColumnVisibility: (columnId: string) => void;
  updateColumnWidth: (columnId: string, width: number) => void;
  // Row features (Phase 3)
  setRowSelection: (selection: RowSelectionState) => void;
  setRowSelectionMode: (mode: RowSelectionMode) => void;
  setLastSelectedRowId: (id: string | null) => void;
  setExpanded: (expanded: ExpandedState) => void;
  toggleRowExpanded: (rowId: string) => void;
  setRowPinning: (pinning: RowPinningState) => void;
  pinRow: (rowId: string, position: "top" | "bottom" | false) => void;
  setGrouping: (grouping: GroupingState) => void;
  // Formula engine (Phase 6)
  incrementRenderTrigger: () => void;
  // Polish (Phase 7) — formatting + context menu
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

/** TanStack Table meta for cell updates */
export interface SpreadsheetTableMeta {
  updateData: (rowIndex: number, columnId: string, value: CellValue) => void;
  getColumnConfig: (columnId: string) => SpreadsheetColumnConfig | undefined;
}

/** Props for the top-level Spreadsheet component */
export interface SpreadsheetProps<TData extends Record<string, CellValue>> {
  data: TData[];
  columns: ColumnDef<TData, CellValue>[];
  columnConfigs?: SpreadsheetColumnConfig[];
  onCellChange?: (address: CellAddress, value: CellValue) => void;
  sortable?: boolean;
  filterable?: boolean;
  globalSearchable?: boolean;
  rowHeight?: number;
  defaultColumnWidth?: number;
  className?: string;
  // Row features (Phase 3)
  rowSelectionMode?: RowSelectionMode;
  getSubRows?: (row: TData) => TData[] | undefined;
  grouping?: string[];
}
