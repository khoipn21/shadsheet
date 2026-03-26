import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import type {
  SpreadsheetStore,
  SpreadsheetColumnConfig,
  CellAddress,
  CellValue,
  CellFormat,
  SelectionRange,
  PinPosition,
  RowPinningState,
  RowSelectionMode,
  ContextMenuState,
  TextAlignment,
  MergedCell,
  MergeHistoryEntry,
} from "@/types/spreadsheet-types";
import type { SortingState, ColumnFiltersState, ColumnPinningState, VisibilityState, RowSelectionState, ExpandedState, GroupingState } from "@tanstack/react-table";
import {
  buildMergeLookup,
  findOverlappingMerges,
  getMergeLookupResult,
  mergesOverlap,
  selectionToMergeRegion,
} from "@/utils/merge-cell-utils";

// Enable Immer's Map/Set support for mergedCellLookup state
enableMapSet();

function shiftMergeRegion(
  merge: MergedCell,
  type: "row" | "col",
  index: number,
  direction: "insert" | "delete",
): MergedCell | null {
  const next: MergedCell = { ...merge };
  const start = type === "row" ? merge.row : merge.col;
  const span = type === "row" ? merge.rowSpan : merge.colSpan;
  const end = start + span - 1;

  if (direction === "insert") {
    if (index <= start) {
      if (type === "row") next.row += 1;
      else next.col += 1;
      return next;
    }
    if (index <= end) {
      if (type === "row") next.rowSpan += 1;
      else next.colSpan += 1;
    }
    return next;
  }

  if (index < start) {
    if (type === "row") next.row -= 1;
    else next.col -= 1;
    return next;
  }
  if (index > end) {
    return next;
  }

  if (type === "row") {
    next.rowSpan -= 1;
    return next.rowSpan > 0 ? next : null;
  }
  next.colSpan -= 1;
  return next.colSpan > 0 ? next : null;
}

function remapMergeRegionColumns(
  merge: MergedCell,
  previousVisibleColumnIds: string[],
  nextColumnIndexById: Map<string, number>,
): MergedCell | null {
  const previousIds = previousVisibleColumnIds.slice(
    merge.col,
    merge.col + merge.colSpan,
  );
  if (previousIds.length !== merge.colSpan) return null;

  const remappedIndices = previousIds
    .map((columnId) => nextColumnIndexById.get(columnId))
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);

  if (remappedIndices.length !== previousIds.length) return null;

  const startCol = remappedIndices[0];
  const endCol = remappedIndices[remappedIndices.length - 1];
  const contiguous = endCol - startCol + 1 === remappedIndices.length;
  if (!contiguous) return null;

  return {
    ...merge,
    col: startCol,
    colSpan: remappedIndices.length,
  };
}

function cloneMergedCells(merges: MergedCell[]): MergedCell[] {
  return merges.map((merge) => ({ ...merge }));
}

function areMergedCellsEqual(a: MergedCell[], b: MergedCell[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) {
    const left = a[index];
    const right = b[index];
    if (
      left.row !== right.row ||
      left.col !== right.col ||
      left.rowSpan !== right.rowSpan ||
      left.colSpan !== right.colSpan
    ) {
      return false;
    }
  }
  return true;
}

export const createSpreadsheetStore = (
  initialColumns: SpreadsheetColumnConfig[] = [],
) =>
  create<SpreadsheetStore>()(
    immer((set, get) => ({
      // State
      columns: initialColumns,
        activeCell: null,
        selectionRange: null,
        editingCell: null,
        editValue: null as CellValue,
        formulaPreviewValue: null as string | null,
        validationError: null as string | null,
      sorting: [],
      columnFilters: [],
      globalFilter: "",
      columnOrder: [],
      columnResizePreview: {},
      clipboardSelection: null,
      clipboardSelectionMode: null,
      columnPinning: { left: [], right: [] },
      columnVisibility: {},
      // Row features (Phase 3)
      rowSelection: {},
      rowSelectionMode: "multi" as RowSelectionMode,
      lastSelectedRowId: null,
      expanded: {} as ExpandedState,
      rowPinning: { top: [], bottom: [] },
      grouping: [] as GroupingState,
      // Formula engine (Phase 6)
      renderTrigger: 0,
      // Polish (Phase 7)
      cellFormats: {} as Record<string, CellFormat>,
      contextMenu: null as ContextMenuState | null,
      mergedCells: [] as MergedCell[],
      mergedCellLookup: new Map<string, number>(),
      mergeUndoStack: [] as MergeHistoryEntry[],
      mergeRedoStack: [] as MergeHistoryEntry[],

      // Actions
      setActiveCell: (cell: CellAddress | null) =>
        set((state) => {
          state.activeCell = cell;
        }),

      setSelection: (range: SelectionRange | null) =>
        set((state) => {
          state.selectionRange = range;
        }),

      setEditingCell: (cell: CellAddress | null) =>
        set((state) => {
          state.editingCell = cell;
        }),

        setEditValue: (value: CellValue) =>
          set((state) => {
            state.editValue = value;
          }),

        setFormulaPreviewValue: (value: string | null) =>
          set((state) => {
            state.formulaPreviewValue = value;
          }),

      setValidationError: (error: string | null) =>
        set((state) => {
          state.validationError = error;
        }),

        startEditing: (cell: CellAddress, overwrite = false) =>
          set((state) => {
            state.editingCell = cell;
            state.editValue = overwrite ? "" : null; // null = use current cell value
            state.formulaPreviewValue = null;
            state.validationError = null;
            state.activeCell = cell;
          }),

        cancelEdit: () =>
          set((state) => {
            state.editingCell = null;
            state.editValue = null;
            state.formulaPreviewValue = null;
            state.validationError = null;
          }),

      setSorting: (sorting: SortingState) =>
        set((state) => {
          state.sorting = sorting;
        }),

      setColumnFilters: (filters: ColumnFiltersState) =>
        set((state) => {
          state.columnFilters = filters;
        }),

      setGlobalFilter: (filter: string) =>
        set((state) => {
          state.globalFilter = filter;
        }),

      setColumns: (columns: SpreadsheetColumnConfig[]) =>
        set((state) => {
          state.columns = columns;
        }),

      setColumnOrder: (order: string[]) =>
        set((state) => {
          state.columnOrder = order;
        }),

      setColumnResizePreview: (columnId: string, width: number | null) =>
        set((state) => {
          if (width == null) {
            delete state.columnResizePreview[columnId];
            return;
          }
          state.columnResizePreview[columnId] = width;
        }),

      setClipboardSelection: (range, mode) =>
        set((state) => {
          state.clipboardSelection = range;
          state.clipboardSelectionMode = range ? mode : null;
        }),

      setColumnPinning: (pinning: ColumnPinningState) =>
        set((state) => {
          state.columnPinning = pinning;
        }),

      setColumnVisibility: (visibility: VisibilityState) =>
        set((state) => {
          state.columnVisibility = visibility;
        }),

      pinColumn: (columnId: string, position: PinPosition) =>
        set((state) => {
          // Remove from both pin arrays first
          state.columnPinning.left = (state.columnPinning.left ?? []).filter((id) => id !== columnId);
          state.columnPinning.right = (state.columnPinning.right ?? []).filter((id) => id !== columnId);
          // Add to target array
          if (position === "left") {
            state.columnPinning.left!.push(columnId);
          } else if (position === "right") {
            state.columnPinning.right!.push(columnId);
          }
        }),

      toggleColumnVisibility: (columnId: string) =>
        set((state) => {
          const current = state.columnVisibility[columnId] ?? true;
          // Prevent hiding last visible column — account for sparse visibility map
          if (current) {
            const totalCols = state.columns.length;
            const hiddenCount = Object.values(state.columnVisibility).filter((v) => v === false).length;
            const visibleCount = totalCols - hiddenCount;
            if (visibleCount <= 1) return;
          }
          state.columnVisibility[columnId] = !current;
        }),

      updateColumnWidth: (columnId: string, width: number) =>
        set((state) => {
          const col = state.columns.find((c) => c.id === columnId);
          if (col) col.width = width;
        }),

      // Row feature actions (Phase 3)
      setRowSelection: (selection: RowSelectionState) =>
        set((state) => {
          state.rowSelection = selection;
        }),

      setRowSelectionMode: (mode: RowSelectionMode) =>
        set((state) => {
          state.rowSelectionMode = mode;
        }),

      setLastSelectedRowId: (id: string | null) =>
        set((state) => {
          state.lastSelectedRowId = id;
        }),

      setExpanded: (expanded: ExpandedState) =>
        set((state) => {
          state.expanded = expanded;
        }),

      toggleRowExpanded: (rowId: string) =>
        set((state) => {
          if (typeof state.expanded === "boolean") {
            // When expand-all is true, toggling one row collapses only that row
            // We can't enumerate all IDs here, so let TanStack handle it via onExpandedChange
            state.expanded = { [rowId]: !state.expanded };
          } else {
            state.expanded[rowId] = !state.expanded[rowId];
          }
        }),

      setRowPinning: (pinning: RowPinningState) =>
        set((state) => {
          state.rowPinning = pinning;
        }),

      pinRow: (rowId: string, position: "top" | "bottom" | false) =>
        set((state) => {
          state.rowPinning.top = state.rowPinning.top.filter((id) => id !== rowId);
          state.rowPinning.bottom = state.rowPinning.bottom.filter((id) => id !== rowId);
          if (position === "top") state.rowPinning.top.push(rowId);
          else if (position === "bottom") state.rowPinning.bottom.push(rowId);
        }),

      setGrouping: (grouping: GroupingState) =>
        set((state) => {
          state.grouping = grouping;
        }),

      // Formula engine (Phase 6)
      incrementRenderTrigger: () =>
        set((state) => {
          state.renderTrigger += 1;
        }),

      // Polish (Phase 7) — formatting + context menu
      setCellFormat: (key: string, format: CellFormat) =>
        set((state) => {
          state.cellFormats[key] = { ...state.cellFormats[key], ...format };
        }),

      setCellFormats: (formats: Record<string, CellFormat>) =>
        set((state) => {
          state.cellFormats = formats;
        }),

      toggleBold: (keys: string[]) =>
        set((state) => {
          // If any cell in selection is not bold, make all bold; otherwise unbold all
          const allBold = keys.every((k) => state.cellFormats[k]?.bold);
          for (const k of keys) {
            if (!state.cellFormats[k]) state.cellFormats[k] = {};
            state.cellFormats[k].bold = !allBold;
          }
        }),

      toggleItalic: (keys: string[]) =>
        set((state) => {
          const allItalic = keys.every((k) => state.cellFormats[k]?.italic);
          for (const k of keys) {
            if (!state.cellFormats[k]) state.cellFormats[k] = {};
            state.cellFormats[k].italic = !allItalic;
          }
        }),

      setColor: (keys: string[], color: string) =>
        set((state) => {
          for (const k of keys) {
            if (!state.cellFormats[k]) state.cellFormats[k] = {};
            state.cellFormats[k].color = color;
          }
        }),

      setBgColor: (keys: string[], bgColor: string) =>
        set((state) => {
          for (const k of keys) {
            if (!state.cellFormats[k]) state.cellFormats[k] = {};
            state.cellFormats[k].bgColor = bgColor;
          }
        }),

      setTextAlign: (keys: string[], align: TextAlignment) =>
        set((state) => {
          for (const k of keys) {
            if (!state.cellFormats[k]) state.cellFormats[k] = {};
            state.cellFormats[k].align = align;
          }
        }),

      setContextMenu: (menu: ContextMenuState | null) =>
        set((state) => {
          state.contextMenu = menu;
        }),

      // Shift cell format keys when rows are inserted/deleted
      shiftCellFormatKeys: (rowIndex: number, direction: "up" | "down") =>
        set((state) => {
          const newFormats: Record<string, CellFormat> = {};
          for (const [key, format] of Object.entries(state.cellFormats)) {
            const [rowStr] = key.split("-");
            const r = parseInt(rowStr, 10);
            if (direction === "up" && r >= rowIndex) {
              newFormats[`${r + 1}-${key.slice(key.indexOf("-") + 1)}`] = format;
            } else if (direction === "down" && r > rowIndex) {
              newFormats[`${r - 1}-${key.slice(key.indexOf("-") + 1)}`] = format;
            } else {
              newFormats[key] = format;
            }
          }
          state.cellFormats = newFormats;
        }),

      removeCellFormatRow: (rowIndex: number) =>
        set((state) => {
          const newFormats: Record<string, CellFormat> = {};
          for (const [key, format] of Object.entries(state.cellFormats)) {
            const [rowStr] = key.split("-");
            const r = parseInt(rowStr, 10);
            if (r !== rowIndex) {
              if (r > rowIndex) {
                newFormats[`${r - 1}-${key.slice(key.indexOf("-") + 1)}`] = format;
              } else {
                newFormats[key] = format;
              }
            }
          }
          state.cellFormats = newFormats;
        }),

      mergeCells: (range: SelectionRange, visibleColumnIds: string[]) =>
        set((state) => {
          const nextMerge = selectionToMergeRegion(range, visibleColumnIds);
          if (!nextMerge) return;
          if (nextMerge.rowSpan * nextMerge.colSpan < 2) return;

          const overlapping = findOverlappingMerges(state.mergedCells, nextMerge);
          const overlapSet = new Set(overlapping);
          const withoutOverlaps = state.mergedCells.filter(
            (_, index) => !overlapSet.has(index),
          );
          withoutOverlaps.push(nextMerge);

          state.mergedCells = withoutOverlaps;
          state.mergedCellLookup = buildMergeLookup(withoutOverlaps);
        }),

      unmergeCells: (row: number, col: number) =>
        set((state) => {
          const mergeIndex = state.mergedCellLookup.get(`${row}-${col}`);
          if (mergeIndex == null) return;

          const nextMerges = state.mergedCells.filter(
            (_, index) => index !== mergeIndex,
          );
          state.mergedCells = nextMerges;
          state.mergedCellLookup = buildMergeLookup(nextMerges);
        }),

      recordMergeHistory: (before: MergedCell[]) =>
        set((state) => {
          const beforeSnapshot = cloneMergedCells(before);
          const afterSnapshot = cloneMergedCells(state.mergedCells);
          if (areMergedCellsEqual(beforeSnapshot, afterSnapshot)) return;
          state.mergeUndoStack.push({
            before: beforeSnapshot,
            after: afterSnapshot,
          });
          state.mergeRedoStack = [];
        }),

      undoMergeHistory: () =>
        set((state) => {
          const entry = state.mergeUndoStack.pop();
          if (!entry) return;
          state.mergedCells = cloneMergedCells(entry.before);
          state.mergedCellLookup = buildMergeLookup(state.mergedCells);
          state.mergeRedoStack.push(entry);
        }),

      redoMergeHistory: () =>
        set((state) => {
          const entry = state.mergeRedoStack.pop();
          if (!entry) return;
          state.mergedCells = cloneMergedCells(entry.after);
          state.mergedCellLookup = buildMergeLookup(state.mergedCells);
          state.mergeUndoStack.push(entry);
        }),

      clearMergedCells: () =>
        set((state) => {
          state.mergedCells = [];
          state.mergedCellLookup = new Map<string, number>();
          state.mergeUndoStack = [];
          state.mergeRedoStack = [];
        }),

      reindexMergedCells: (
        previousVisibleColumnIds: string[],
        nextVisibleColumnIds: string[],
      ) =>
        set((state) => {
          if (state.mergedCells.length === 0) return;
          if (
            previousVisibleColumnIds.length === 0 ||
            nextVisibleColumnIds.length === 0
          ) {
            state.mergedCells = [];
            state.mergedCellLookup = new Map<string, number>();
            return;
          }

          const nextColumnIndexById = new Map<string, number>();
          nextVisibleColumnIds.forEach((columnId, index) => {
            if (!nextColumnIndexById.has(columnId)) {
              nextColumnIndexById.set(columnId, index);
            }
          });

          const remapped: MergedCell[] = [];
          for (const merge of state.mergedCells) {
            const candidate = remapMergeRegionColumns(
              merge,
              previousVisibleColumnIds,
              nextColumnIndexById,
            );
            if (!candidate) continue;
            if (remapped.some((existing) => mergesOverlap(existing, candidate))) {
              continue;
            }
            remapped.push(candidate);
          }

          state.mergedCells = remapped;
          state.mergedCellLookup = buildMergeLookup(remapped);
        }),

      getMergeLookup: (row: number, col: number) => {
        const state = get();
        return getMergeLookupResult(
          state.mergedCells,
          state.mergedCellLookup,
          row,
          col,
        );
      },

      shiftMergedCells: (
        type: "row" | "col",
        index: number,
        direction: "insert" | "delete",
      ) =>
        set((state) => {
          const shifted = state.mergedCells
            .map((merge) => shiftMergeRegion(merge, type, index, direction))
            .filter((merge): merge is MergedCell => merge !== null);
          state.mergedCells = shifted;
          state.mergedCellLookup = buildMergeLookup(shifted);
        }),
    })),
  );
