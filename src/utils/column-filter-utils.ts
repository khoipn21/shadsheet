import type { FilterFn } from "@tanstack/react-table";
import type {
  CellValue,
  SpreadsheetColumnFilterValue,
  SpreadsheetRowData,
} from "@/types/spreadsheet-types";

const QUOTED_STRING_PATTERN = /^(['"])(.*)\1$/;

export function normalizeColumnFilterValue(
  value: unknown,
): SpreadsheetColumnFilterValue {
  if (typeof value === "string") {
    return { search: value, expression: "" };
  }

  if (value && typeof value === "object") {
    const candidate = value as Partial<SpreadsheetColumnFilterValue>;
    return {
      search: typeof candidate.search === "string" ? candidate.search : "",
      expression:
        typeof candidate.expression === "string" ? candidate.expression : "",
    };
  }

  return { search: "", expression: "" };
}

export function isColumnFilterActive(value: SpreadsheetColumnFilterValue) {
  return value.search.trim().length > 0 || value.expression.trim().length > 0;
}

function stringifyCellValue(value: CellValue) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isBlankValue(value: CellValue) {
  return value == null || stringifyCellValue(value).trim() === "";
}

function parseLiteral(raw: string): string | number | boolean | Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const quotedMatch = trimmed.match(QUOTED_STRING_PATTERN);
  if (quotedMatch) return quotedMatch[2];

  if (/^null$/i.test(trimmed) || /^blank$/i.test(trimmed)) return null;
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;

  const numericValue = Number(trimmed);
  if (!Number.isNaN(numericValue) && trimmed !== "") return numericValue;

  const dateValue = new Date(trimmed);
  if (!Number.isNaN(dateValue.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return dateValue;
  }

  return trimmed;
}

function splitAtTopLevel(expression: string, operator: "OR" | "AND") {
  const parts: string[] = [];
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let start = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    const nextChar = expression[index + 1];

    if (quote) {
      if (char === quote && expression[index - 1] !== "\\") quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth !== 0) continue;

    const operatorMatch =
      operator === "OR"
        ? char === "|" && nextChar === "|"
        : char === "&" && nextChar === "&";

    if (operatorMatch) {
      parts.push(expression.slice(start, index).trim());
      start = index + 2;
      index += 1;
      continue;
    }

    const word = operator === "OR" ? "OR" : "AND";
    if (
      expression.slice(index, index + word.length).toUpperCase() === word &&
      !/[A-Z0-9_]/i.test(expression[index - 1] ?? "") &&
      !/[A-Z0-9_]/i.test(expression[index + word.length] ?? "")
    ) {
      parts.push(expression.slice(start, index).trim());
      start = index + word.length;
      index += word.length - 1;
    }
  }

  if (start === 0) return null;
  parts.push(expression.slice(start).trim());
  return parts.filter(Boolean);
}

function unwrapExpression(expression: string) {
  let current = expression.trim();

  while (current.startsWith("(") && current.endsWith(")")) {
    let depth = 0;
    let isWrapped = true;

    for (let index = 0; index < current.length; index += 1) {
      const char = current[index];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (depth === 0 && index < current.length - 1) {
        isWrapped = false;
        break;
      }
    }

    if (!isWrapped) break;
    current = current.slice(1, -1).trim();
  }

  return current;
}

function splitArguments(input: string) {
  const args: string[] = [];
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let start = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      args.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }

  args.push(input.slice(start).trim());
  return args.filter(Boolean);
}

function compareOrderedValues(
  cellValue: CellValue,
  target: string | number | boolean | Date | null,
) {
  if (cellValue instanceof Date || target instanceof Date) {
    const left = cellValue instanceof Date ? cellValue.getTime() : new Date(String(cellValue)).getTime();
    const right = target instanceof Date ? target.getTime() : new Date(String(target)).getTime();
    if (Number.isNaN(left) || Number.isNaN(right)) return null;
    return left - right;
  }

  if (typeof cellValue === "number" || typeof target === "number") {
    const left = Number(cellValue);
    const right = Number(target);
    if (Number.isNaN(left) || Number.isNaN(right)) return null;
    return left - right;
  }

  const left = stringifyCellValue(cellValue).toLowerCase();
  const right = stringifyCellValue(target as CellValue).toLowerCase();
  return left.localeCompare(right);
}

function evaluateFunction(value: CellValue, name: string, rawArgs: string[]) {
  const normalizedName = name.toLowerCase();
  const cellText = stringifyCellValue(value).toLowerCase();
  const parsedArgs = rawArgs.map(parseLiteral);

  switch (normalizedName) {
    case "contains":
    case "includes":
      return cellText.includes(String(parsedArgs[0] ?? "").toLowerCase());
    case "startswith":
      return cellText.startsWith(String(parsedArgs[0] ?? "").toLowerCase());
    case "endswith":
      return cellText.endsWith(String(parsedArgs[0] ?? "").toLowerCase());
    case "blank":
    case "empty":
      return isBlankValue(value);
    case "notblank":
    case "notempty":
      return !isBlankValue(value);
    case "between": {
      const lower = compareOrderedValues(value, parsedArgs[0] ?? null);
      const upper = compareOrderedValues(value, parsedArgs[1] ?? null);
      return lower !== null && upper !== null && lower >= 0 && upper <= 0;
    }
    case "in":
      return parsedArgs.some(
        (arg) =>
          compareOrderedValues(value, arg) === 0 ||
          cellText === String(arg ?? "").toLowerCase(),
      );
    case "matches":
    case "regex": {
      const pattern = String(parsedArgs[0] ?? "");
      const flags = String(parsedArgs[1] ?? "i");
      const literalMatch = pattern.match(/^\/(.*)\/([a-z]*)$/i);
      const regex = literalMatch
        ? new RegExp(literalMatch[1], literalMatch[2])
        : new RegExp(pattern, flags);
      return regex.test(stringifyCellValue(value));
    }
    default:
      return cellText.includes(String(parsedArgs[0] ?? normalizedName).toLowerCase());
  }
}

function evaluateExpression(value: CellValue, expression: string): boolean {
  const current = unwrapExpression(expression);
  if (!current) return true;

  const orParts = splitAtTopLevel(current, "OR");
  if (orParts) return orParts.some((part) => evaluateExpression(value, part));

  const andParts = splitAtTopLevel(current, "AND");
  if (andParts) return andParts.every((part) => evaluateExpression(value, part));

  if (/^!\s*(?!=)/.test(current)) {
    return !evaluateExpression(value, current.replace(/^!\s*/, ""));
  }

  if (/^not\s+/i.test(current)) {
    return !evaluateExpression(value, current.replace(/^not\s+/i, ""));
  }

  const functionMatch = current.match(/^([a-z_][a-z0-9_]*)\((.*)\)$/i);
  if (functionMatch) {
    return evaluateFunction(value, functionMatch[1], splitArguments(functionMatch[2]));
  }

  if (/^(blank|empty)$/i.test(current)) return isBlankValue(value);
  if (/^(not\s+blank|not\s+empty)$/i.test(current)) return !isBlankValue(value);

  const comparatorMatch = current.match(/^(<=|>=|!=|==|=|<|>)(.+)$/);
  if (comparatorMatch) {
    const [, operator, rawTarget] = comparatorMatch;
    const target = parseLiteral(rawTarget);
    const ordered = compareOrderedValues(value, target);
    if (ordered === null) return false;
    if (operator === "=" || operator === "==") return ordered === 0;
    if (operator === "!=") return ordered !== 0;
    if (operator === ">") return ordered > 0;
    if (operator === ">=") return ordered >= 0;
    if (operator === "<") return ordered < 0;
    if (operator === "<=") return ordered <= 0;
  }

  return stringifyCellValue(value).toLowerCase().includes(current.toLowerCase());
}

export function evaluateColumnFilter(
  value: CellValue,
  filterValue: SpreadsheetColumnFilterValue,
) {
  const normalized = normalizeColumnFilterValue(filterValue);
  if (normalized.search.trim()) {
    const cellText = stringifyCellValue(value).toLowerCase();
    if (!cellText.includes(normalized.search.trim().toLowerCase())) {
      return false;
    }
  }

  if (normalized.expression.trim()) {
    return evaluateExpression(value, normalized.expression.trim());
  }

  return true;
}

export const spreadsheetColumnFilterFn: FilterFn<SpreadsheetRowData> = (
  row,
  columnId,
  filterValue,
) => evaluateColumnFilter(row.getValue(columnId) as CellValue, normalizeColumnFilterValue(filterValue));

spreadsheetColumnFilterFn.autoRemove = (value) =>
  !isColumnFilterActive(normalizeColumnFilterValue(value));
