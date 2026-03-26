// ============================================================
// Main Entry Point - @shadsheet/ui
// ============================================================
// CSS is no longer auto-imported. Import explicitly:
//   import "@shadsheet/ui/style.css";

// ============================================================
// Main Component (Batteries-Included)
// ============================================================
export { Spreadsheet } from "./components/spreadsheet/spreadsheet";

// ============================================================
// Sub-Components (Composable)
// ============================================================
export { SpreadsheetGrid } from "./components/spreadsheet/spreadsheet-grid";
export type { SpreadsheetGridApi } from "./components/spreadsheet/spreadsheet-grid";
export { Toolbar } from "./components/spreadsheet/toolbar";
export { FormulaBar } from "./components/spreadsheet/formula-bar";
export { StatusBar } from "./components/spreadsheet/status-bar";
export { ColumnHeaders } from "./components/spreadsheet/column-headers";
export { GlobalSearchFilter } from "./components/spreadsheet/global-search-filter";
export { ColumnFilterPanel } from "./components/spreadsheet/column-filter-panel";
export { ContextMenu } from "./components/spreadsheet/context-menu";
export { CellEditorSwitch } from "./components/spreadsheet/cell-editor-switch";
export { CellRenderer } from "./components/spreadsheet/cell-renderer";

// ============================================================
// Providers & Contexts
// ============================================================
export {
  SpreadsheetProvider,
  SpreadsheetContext,
  TableContext,
  HyperFormulaContext,
} from "./components/spreadsheet/spreadsheet-provider";

// ============================================================
// Hooks
// ============================================================
export { useSpreadsheetStore } from "./hooks/use-spreadsheet-store";
export { useCellSelection } from "./hooks/use-cell-selection";
export { useClipboard } from "./hooks/use-clipboard";
export { useColumnResize } from "./hooks/use-column-resize";
export { useKeyboardNavigation } from "./hooks/use-keyboard-navigation";
export { useHyperFormula } from "./hooks/use-hyperformula";
export { useMergeCells } from "./hooks/use-merge-cells";
export { useGridOperations } from "./hooks/use-grid-operations";
export { useAutoFill } from "./hooks/use-auto-fill";

// ============================================================
// Utilities
// ============================================================
export { exportToCSV, exportToXLSX } from "./utils/export-utils";
export {
  spreadsheetColumnFilterFn,
  evaluateColumnFilter,
  normalizeColumnFilterValue,
  isColumnFilterActive,
} from "./utils/column-filter-utils";
export { validateCellValue, isCellEditable } from "./utils/validation-utils";
export {
  colIndexToLetter,
  letterToColIndex,
  toA1,
  fromA1,
} from "./utils/cell-address";
export { createSpreadsheetStore } from "./stores/spreadsheet-store";

// ============================================================
// Types
// ============================================================
export type {
  // Core types
  CellValue,
  SpreadsheetRowData,
  ColumnType,
  ValidationResult,
  CellEditorProps,
  SelectOption,
  CellAddress,
  SelectionRange,
  MergedCell,
  MergeLookupResult,
  ClipboardSelectionMode,
  PinPosition,
  RowPinningState,
  RowSelectionMode,
  SpreadsheetRowSelectionMode,
  AggregationType,
  CellFormat,
  ConditionalFormatRule,
  TextAlignment,
  ContextMenuState,
  MergeHistoryEntry,

  // Column config types
  SpreadsheetColumnConfig,
  ColumnConfig,

  // Callback payload types
  SpreadsheetCellChange,
  SpreadsheetSelectionState,
  SpreadsheetSortDescriptor,
  SpreadsheetColumnFilterValue,
  SpreadsheetFilterDescriptor,
  SpreadsheetFilterState,
  SpreadsheetExportFormat,

  // Feature flags
  SpreadsheetFeatureFlags,

  // Ref API
  SpreadsheetRef,

  // Props
  SpreadsheetProps,

  // Store types
  SpreadsheetUIState,
  SpreadsheetUIActions,
  SpreadsheetStore,
  SpreadsheetTableMeta,
} from "./types/spreadsheet-types";