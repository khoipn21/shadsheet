# ShadSheet

Headless React spreadsheet component library built with React 19, TanStack Table, TanStack Virtual, Zustand, and HyperFormula.

## Install

```bash
npm install @khoipn2112/shadsheet react react-dom
```

Import the bundled stylesheet once in your app entry:

```ts
import "@khoipn2112/shadsheet/style.css";
```

## Requirements

- React 19+
- Browser or client-rendered React environment
- A parent container with an explicit height because `Spreadsheet` defaults to `height="100%"`

## Quick Start

```tsx
import { Spreadsheet, type ColumnConfig } from "@khoipn2112/shadsheet";

type Row = {
  A: string;
  B: number;
  C: boolean;
};

const columns: ColumnConfig<Row>[] = [
  { id: "A", header: "Name", editable: true, sortable: true, width: 180 },
  { id: "B", header: "Amount", type: "number", editable: true, width: 140 },
  { id: "C", header: "Active", type: "checkbox", editable: true, width: 120 },
];

const data: Row[] = [
  { A: "Alpha", B: 120, C: true },
  { A: "Beta", B: 80, C: false },
];

export function Example() {
  return (
    <div style={{ height: 480 }}>
      <Spreadsheet
        data={data}
        columns={columns}
        exportFileName="orders"
        onCellChange={({ rowIndex, columnId, newValue }) => {
          console.log("Edited", rowIndex, columnId, newValue);
        }}
      />
    </div>
  );
}
```

## What It Includes

- Virtualized row rendering and virtualized center columns for large datasets
- Left and right pinned column panes
- Column sorting, hiding, pinning, resize handles, and auto-fit
- Global search plus per-column filter panels with expression filters
- Inline cell editors for text, number, date, select, and checkbox columns
- Formula bar backed by HyperFormula
- Range selection, keyboard navigation, clipboard copy/cut/paste, and status bar aggregates
- Toolbar formatting controls and CSV/XLSX export
- Tree rows, grouping, row selection, and light or dark theme support

## Headless API

ShadSheet exports a layered API for different levels of control:

### Components

```tsx
import {
  Spreadsheet,        // Batteries-included
  SpreadsheetGrid,    // Virtualized grid only
  Toolbar,            // Formatting toolbar
  FormulaBar,         // Formula input
  StatusBar,          // Row count + aggregates
  ColumnHeaders,      // Header row with sorting/filtering
} from "@shadsheet/ui";
```

### Hooks

```tsx
import {
  useSpreadsheetStore,   // Access Zustand store
  useCellSelection,      // Selection logic
  useClipboard,          // Copy/cut/paste
  useKeyboardNavigation, // Arrow keys, Tab, Enter
  useHyperFormula,       // Formula engine access
  useMergeCells,         // Cell merging
  useColumnResize,       // Column width resizing
  useGridOperations,     // Insert/delete rows/columns
  useAutoFill,           // Fill handle
} from "@shadsheet/ui";
```

### Providers & Contexts

```tsx
import {
  SpreadsheetProvider,   // Context wrapper
  SpreadsheetContext,    // Zustand store context
  TableContext,          // TanStack Table context
  HyperFormulaContext,   // Formula engine context
} from "@shadsheet/ui";
```

### Utilities

```tsx
import {
  exportToCSV,               // CSV export
  exportToXLSX,              // XLSX export
  spreadsheetColumnFilterFn, // Filter expression parser
  evaluateColumnFilter,      // Filter expression evaluator
  validateCellValue,         // Zod-based validation
  colIndexToLetter,          // Column index to letter (0→A)
  letterToColIndex,          // Letter to column index (A→0)
  toA1,                      // Row/col to A1 notation
  fromA1,                    // A1 notation to row/col
  createSpreadsheetStore,    // Standalone store factory
} from "@shadsheet/ui";
```

## Public Component Surface

`Spreadsheet` is the package entry point.

Key props:

- `data`, `columns`
- `getRowId`, `getSubRows`
- `sortable`, `filterable`, `editable`, `resizableColumns`, `formulasEnabled`
- `showToolbar`, `showFormulaBar`, `globalSearchable`
- `rowSelection`
- `pinnedColumns`, `grouping`
- `height`, `defaultColumnWidth`, `exportFileName`, `theme`, `className`

Column config supports:

- `id`, `header`, `width`, `minWidth`, `maxWidth`
- `sortable`, `filterable`, `pinned`
- `type` of `text | number | date | select | checkbox`
- `editable` as `boolean` or row predicate
- `validation` via Zod schema
- `options` for select columns

## Callbacks

- `onSelectionChange(selection)`
- `onCellChange(change)`
- `onBeforeCellEdit(cell, row)`
- `onSort(sorting)`
- `onFilter(filters)`
- `onExport(format)`

Behavior notes:

- `onCellChange` can veto an edit by returning `false`.
- `onBeforeCellEdit` can block entry into edit mode for a specific cell.
- `onFilter` returns both global search and per-column filter state.

## Ref API

`SpreadsheetRef` exposes:

- `focus()`
- `scrollToCell(rowIndex, columnIndexOrId)`
- `getSelectedData()`
- `getData()`
- `setData(data)`
- `exportToCSV()`
- `exportToXLSX()`
- `undo()`
- `redo()`

`exportToXLSX()` is async.

## Filter Expressions

Each column menu supports plain search and an expression mode. Examples:

- `>100 && <500`
- `contains(alpha)`
- `blank()`
- `in(open,closed)`
- `regex(^A)`
- `between(2026-01-01, 2026-12-31)`

Supported operators and helpers include `=`, `!=`, `>`, `>=`, `<`, `<=`, `&&`, `||`, `not`, `contains`, `startsWith`, `endsWith`, `between`, `in`, `blank`, and `regex`.

## Storybook

Storybook stories cover:

- default grid
- read-only mode
- large dataset virtualization
- formulas
- pinned columns
- tree rows
- dark theme

Run locally with:

```bash
npm run storybook
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run storybook
npm run build-storybook
```

## Current Notes

- This package is browser-oriented. Clipboard, download, and DOM APIs are used directly.
- Build and Storybook are configured. A dedicated automated test runner is not configured in `package.json` yet.
- The docs only guarantee the features described here. Partially wired behavior in the codebase, such as structural row or column commands and auto-fill, is intentionally not advertised as stable package contract yet.

## Migration from v0.2.x

The package name changed from `spreadsheet` to `@shadsheet/ui`. Update your imports:

```ts
// Before
import { Spreadsheet } from "spreadsheet";
import "spreadsheet/style.css";

// After
import { Spreadsheet } from "@shadsheet/ui";
import "@khoipn2112/shadsheet/style.css";
```

The CSS import is now required explicitly (no longer auto-imported).