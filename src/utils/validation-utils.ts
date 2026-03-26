import type { ZodSchema } from "zod";
import type { CellValue, ValidationResult, SpreadsheetColumnConfig } from "@/types/spreadsheet-types";

/**
 * Validate a cell value against the column's Zod schema.
 * Returns { success: true } if no schema or value passes validation.
 */
export function validateCellValue(
  value: CellValue,
  columnConfig: SpreadsheetColumnConfig,
): ValidationResult {
  if (!columnConfig.validation) {
    return { success: true };
  }

  const result = (columnConfig.validation as ZodSchema).safeParse(value);
  if (result.success) {
    return { success: true };
  }

  const errorMessage = result.error.errors[0]?.message ?? "Invalid value";
  return { success: false, error: errorMessage };
}

/**
 * Check if a cell is editable given column config and row data.
 */
export function isCellEditable(
  columnConfig: SpreadsheetColumnConfig | undefined,
  rowData?: Record<string, CellValue>,
): boolean {
  if (!columnConfig) return false;
  if (columnConfig.editable === undefined) return true; // default editable
  if (typeof columnConfig.editable === "function") {
    return rowData ? columnConfig.editable(rowData) : true;
  }
  return columnConfig.editable;
}
