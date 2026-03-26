import type { HyperFormula } from "hyperformula";
import type {
  CellValue,
  SpreadsheetColumnConfig,
  SpreadsheetRowData,
} from "@/types/spreadsheet-types";

/** Re-export HyperFormula type for use in other modules. */
export type HyperFormulaInstance = HyperFormula;

/** Lazy-loaded HyperFormula module — shared promise so we only import once. */
let hfModulePromise: Promise<typeof import("hyperformula")> | null = null;

const MERGE_HISTORY_SHEET_NAME = "__spreadsheet_merge_history__";
const MERGE_HISTORY_MARKER_ROW = 0;
const MERGE_HISTORY_MARKER_COL = 0;

function loadHyperFormula() {
  if (!hfModulePromise) {
    hfModulePromise = import("hyperformula");
  }
  return hfModulePromise;
}

function ensureMergeHistorySheet(hf: HyperFormula): number {
  let sheetId = hf.getSheetId(MERGE_HISTORY_SHEET_NAME);
  if (sheetId != null) return sheetId;

  hf.addSheet(MERGE_HISTORY_SHEET_NAME);
  sheetId = hf.getSheetId(MERGE_HISTORY_SHEET_NAME);
  if (sheetId == null) {
    throw new Error("Failed to initialize merge history sheet.");
  }
  return sheetId;
}

export function appendMergeHistoryMarker(hf: HyperFormula) {
  const sheetId = ensureMergeHistorySheet(hf);
  const currentValue = hf.getCellValue({
    sheet: sheetId,
    row: MERGE_HISTORY_MARKER_ROW,
    col: MERGE_HISTORY_MARKER_COL,
  });
  const nextMarker =
    typeof currentValue === "number" && Number.isFinite(currentValue)
      ? currentValue + 1
      : 1;
  hf.setCellContents(
    {
      sheet: sheetId,
      row: MERGE_HISTORY_MARKER_ROW,
      col: MERGE_HISTORY_MARKER_COL,
    },
    [[nextMarker]],
  );
}

export function didUndoRedoTouchMergeHistoryMarker(
  hf: HyperFormula,
  changes: unknown,
): boolean {
  const sheetId = hf.getSheetId(MERGE_HISTORY_SHEET_NAME);
  if (sheetId == null) return false;

  // Guard against non-array changes (HyperFormula may return undefined or non-array in edge cases)
  if (!Array.isArray(changes)) return false;

  return changes.some((change) => {
    if (!change || typeof change !== "object") return false;
    const address = (change as { address?: { sheet?: number; row?: number; col?: number } }).address;
    if (!address) return false;
    return (
      address.sheet === sheetId &&
      address.row === MERGE_HISTORY_MARKER_ROW &&
      address.col === MERGE_HISTORY_MARKER_COL
    );
  });
}

/** Convert row objects to HyperFormula sheet data ordered by column config. */
export function toSheetData(
  data: SpreadsheetRowData[],
  columns: SpreadsheetColumnConfig[],
) {
  const columnIds = columns.map((column) => column.id);
  return data.map((row) =>
    columnIds.map((id) => {
      const value = row[id];
      if (value instanceof Date) return value.toISOString();
      return value ?? null;
    }),
  );
}

/** Read the current HyperFormula sheet back into row objects. */
export function readSheetRows<TData extends SpreadsheetRowData>(
  hf: HyperFormula,
  columns: SpreadsheetColumnConfig<TData>[],
): TData[] {
  // Guard against empty columns
  if (!columns.length) return [];

  // Guard: check if sheet exists
  try {
    const sheetId = hf.getSheetId("Sheet1");
    if (sheetId == null) return [];
  } catch {
    return [];
  }

  const dims = hf.getSheetDimensions(0);
  // Guard against invalid dimensions
  if (!dims || dims.height <= 0 || dims.width <= 0) return [];

  const rows: TData[] = [];

  for (let rowIndex = 0; rowIndex < dims.height; rowIndex += 1) {
    const row = {} as TData;
    columns.forEach((column, columnIndex) => {
      const value = hf.getCellValue({ sheet: 0, row: rowIndex, col: columnIndex });
      row[column.id as keyof TData] = (
        value !== null && typeof value === "object" && "type" in value
          ? null
          : value
      ) as TData[keyof TData];
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Replace the first HyperFormula sheet with a new dataset.
 * Consumers should bump renderTrigger after calling this helper.
 */
export function replaceSheetData(
  hf: HyperFormula,
  data: SpreadsheetRowData[],
  columns: SpreadsheetColumnConfig[],
): void {
  // Guard: check if sheet exists
  try {
    const sheetId = hf.getSheetId("Sheet1");
    if (sheetId == null) return;
  } catch {
    return;
  }
  hf.setSheetContent(0, toSheetData(data, columns));
}

/**
 * Create a HyperFormula instance populated with the given data.
 * Lazy-loads HyperFormula on first call (code-split).
 */
export async function createHyperFormulaInstance(
  data: SpreadsheetRowData[],
  columns: SpreadsheetColumnConfig[],
): Promise<HyperFormula> {
  const { HyperFormula: HF } = await loadHyperFormula();

  const hf = HF.buildEmpty({ licenseKey: "gpl-v3" });
  hf.addSheet("Sheet1");
  ensureMergeHistorySheet(hf);

  const sheetData = toSheetData(data, columns);
  if (sheetData.length > 0) {
    hf.setSheetContent(0, sheetData);
  }

  // Clear undo/redo stacks so sheet creation cannot be undone
  // This prevents "There's no sheet with id = 0" error when user undos too far
  hf.clearUndoStack();
  hf.clearRedoStack();

  return hf;
}

/** Get display value from HyperFormula (computed formula result or raw value). */
export function getCellDisplayValue(
  hf: HyperFormula,
  row: number,
  col: number,
): CellValue {
  // Guard: check if sheet 0 exists
  try {
    const sheetId = hf.getSheetId("Sheet1");
    if (sheetId == null) return null;
  } catch {
    return null;
  }
  const val = hf.getCellValue({ sheet: 0, row, col });
  if (val !== null && typeof val === "object" && "type" in val) {
    return formatCellError(val);
  }
  return val as CellValue;
}

/** Get raw/serialized value (shows formula string like "=SUM(A1:A10)" for formula cells). */
export function getCellRawValue(
  hf: HyperFormula,
  row: number,
  col: number,
): string {
  // Guard: check if sheet 0 exists
  try {
    const sheetId = hf.getSheetId("Sheet1");
    if (sheetId == null) return "";
  } catch {
    return "";
  }
  const serialized = hf.getCellSerialized({ sheet: 0, row, col });
  if (serialized == null) return "";
  return String(serialized);
}

/** Format HyperFormula CellError to display string. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCellError(error: any): string {
  const errorType = error?.type ?? "ERROR";
  const errorMap: Record<string, string> = {
    REF: "#REF!",
    VALUE: "#VALUE!",
    DIV_BY_ZERO: "#DIV/0!",
    NAME: "#NAME?",
    NUM: "#NUM!",
    NA: "#N/A",
    CYCLE: "#CYCLE!",
    ERROR: "#ERROR!",
  };
  return errorMap[errorType] ?? `#${errorType}!`;
}

/** Check if a display value is a formula error string. */
export function isFormulaError(value: CellValue): boolean {
  return typeof value === "string" && value.startsWith("#") && value.endsWith("!");
}
