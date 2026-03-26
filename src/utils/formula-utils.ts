import type { HyperFormula } from "hyperformula";
import type { CellValue, SpreadsheetColumnConfig } from "@/types/spreadsheet-types";

/** Re-export HyperFormula type for use in other modules */
export type HyperFormulaInstance = HyperFormula;

/** Lazy-loaded HyperFormula module — shared promise so we only import once */
let hfModulePromise: Promise<typeof import("hyperformula")> | null = null;

function loadHyperFormula() {
  if (!hfModulePromise) {
    hfModulePromise = import("hyperformula");
  }
  return hfModulePromise;
}

/**
 * Create a HyperFormula instance populated with the given data.
 * Lazy-loads HyperFormula on first call (code-split).
 */
export async function createHyperFormulaInstance(
  data: Record<string, CellValue>[],
  columns: SpreadsheetColumnConfig[],
): Promise<HyperFormula> {
  const { HyperFormula: HF } = await loadHyperFormula();

  const hf = HF.buildEmpty({ licenseKey: "gpl-v3" });
  hf.addSheet("Sheet1");

  // Convert row objects to 2D array ordered by column config
  const colIds = columns.map((c) => c.id);
  const sheetData = data.map((row) =>
    colIds.map((id) => {
      const v = row[id];
      if (v instanceof Date) return v.toISOString();
      return v ?? null;
    }),
  );

  if (sheetData.length > 0) {
    hf.setSheetContent(0, sheetData);
  }

  return hf;
}

/** Get display value from HyperFormula (computed formula result or raw value) */
export function getCellDisplayValue(
  hf: HyperFormula,
  row: number,
  col: number,
): CellValue {
  const val = hf.getCellValue({ sheet: 0, row, col });
  if (val !== null && typeof val === "object" && "type" in val) {
    return formatCellError(val);
  }
  return val as CellValue;
}

/** Get raw/serialized value (shows formula string like "=SUM(A1:A10)" for formula cells) */
export function getCellRawValue(
  hf: HyperFormula,
  row: number,
  col: number,
): string {
  const serialized = hf.getCellSerialized({ sheet: 0, row, col });
  if (serialized == null) return "";
  return String(serialized);
}

/** Format HyperFormula CellError to display string */
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

/** Check if a display value is a formula error string */
export function isFormulaError(value: CellValue): boolean {
  return typeof value === "string" && value.startsWith("#") && value.endsWith("!");
}
