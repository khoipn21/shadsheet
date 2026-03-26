import type { CellAddress } from "@/types/spreadsheet-types";
import { colIndexToLetter, fromA1 } from "@/utils/cell-address";

const FORMULA_REFERENCE_PATTERN = /\$?[A-Z]{1,4}\$?\d+(?::\$?[A-Z]{1,4}\$?\d+)?/gi;
const MAX_EXPANDED_RANGE_CELLS = 256;

export interface FormulaReferenceToken {
  text: string;
  start: number;
  end: number;
  normalized: string;
  color: string;
  cells: CellAddress[];
}

export interface FormulaReferenceSegment {
  text: string;
  color?: string;
}

export function isFormulaValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("=");
}

function normalizeReferenceToken(token: string): string {
  return token.toUpperCase().replace(/\$/g, "");
}

function getReferenceBounds(reference: string) {
  const [startRef, endRef] = normalizeReferenceToken(reference).split(":");
  const start = fromA1(startRef);
  const end = endRef ? fromA1(endRef) : start;

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

function isReferenceBoundaryCharacter(char?: string): boolean {
  return !char || !/[A-Za-z0-9_]/.test(char);
}

function toCellAddress(row: number, col: number): CellAddress {
  return { rowIndex: row, columnId: colIndexToLetter(col) };
}

function expandReferenceCells(normalized: string): CellAddress[] {
  const [startRef, endRef] = normalized.split(":");
  const start = fromA1(startRef);
  if (!start) return [];

  if (!endRef) {
    return [toCellAddress(start.row, start.col)];
  }

  const end = fromA1(endRef);
  if (!end) {
    return [toCellAddress(start.row, start.col)];
  }

  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const totalCells = (maxRow - minRow + 1) * (maxCol - minCol + 1);

  if (totalCells > MAX_EXPANDED_RANGE_CELLS) {
    return [
      toCellAddress(start.row, start.col),
      toCellAddress(end.row, end.col),
    ];
  }

  const cells: CellAddress[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      cells.push(toCellAddress(row, col));
    }
  }

  return cells;
}

export function getFormulaReferenceColor(reference: string): string {
  const bounds = getReferenceBounds(reference);
  if (bounds) {
    const { start, end } = bounds;
    const rowSeed = start.row * 137 + end.row * 73;
    const colSeed = start.col * 59 + end.col * 31;
    const rangeSeed = Math.abs(end.row - start.row) * 19 + Math.abs(end.col - start.col) * 23;
    const hue = (rowSeed + colSeed + rangeSeed * 11) % 360;
    const saturation = 70 + ((start.col * 17 + start.row * 7 + rangeSeed) % 16);
    const lightness = 40 + ((start.row * 11 + start.col * 13 + rangeSeed * 3) % 14);

    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  const normalized = normalizeReferenceToken(reference);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 131 + normalized.charCodeAt(index)) % 3600;
  }

  const hue = hash % 360;
  const saturation = 72 + (hash % 12);
  const lightness = 42 + (Math.floor(hash / 11) % 8);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function getFormulaReferences(formula: string): FormulaReferenceToken[] {
  if (!isFormulaValue(formula)) return [];

  const references: FormulaReferenceToken[] = [];
  FORMULA_REFERENCE_PATTERN.lastIndex = 0;

  for (const match of formula.matchAll(FORMULA_REFERENCE_PATTERN)) {
    const text = match[0];
    const start = match.index ?? 0;
    const end = start + text.length;
    const before = formula[start - 1];
    const after = formula[end];

    if (
      !isReferenceBoundaryCharacter(before) ||
      !isReferenceBoundaryCharacter(after)
    ) {
      continue;
    }

    const normalized = normalizeReferenceToken(text);
    references.push({
      text,
      start,
      end,
      normalized,
      color: getFormulaReferenceColor(normalized),
      cells: expandReferenceCells(normalized),
    });
  }

  return references;
}

export function getFormulaReferenceSegments(
  value: string,
): FormulaReferenceSegment[] {
  const references = getFormulaReferences(value);
  if (references.length === 0) {
    return [{ text: value }];
  }

  const segments: FormulaReferenceSegment[] = [];
  let cursor = 0;

  for (const reference of references) {
    if (reference.start > cursor) {
      segments.push({ text: value.slice(cursor, reference.start) });
    }

    segments.push({
      text: value.slice(reference.start, reference.end),
      color: reference.color,
    });
    cursor = reference.end;
  }

  if (cursor < value.length) {
    segments.push({ text: value.slice(cursor) });
  }

  return segments;
}

export function getFormulaReferenceColorMap(formula: string): Map<string, string> {
  const colorMap = new Map<string, string>();

  for (const reference of getFormulaReferences(formula)) {
    for (const cell of reference.cells) {
      const key = `${cell.rowIndex}:${cell.columnId}`;
      if (!colorMap.has(key)) {
        colorMap.set(key, reference.color);
      }
    }
  }

  return colorMap;
}
