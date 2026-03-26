# Spreadsheet

Reusable React spreadsheet grid built with TanStack Table, TanStack Virtual, Zustand, and HyperFormula.

## Install

```bash
npm install spreadsheet react react-dom
```

Import the bundled styles once:

```typescript
import "spreadsheet/style.css";
```

## Quick Start

```tsx
import { Spreadsheet, type ColumnConfig } from "spreadsheet";

type Row = {
  A: string;
  B: number;
  C: boolean;
};

const columns: ColumnConfig<Row>[] = [
  { id: "A", header: "Name", editable: true, sortable: true },
  { id: "B", header: "Amount", type: "number", editable: true },
  { id: "C", header: "Active", type: "checkbox" },
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

## Public API

- `Spreadsheet` exposes a single top-level component with toolbar, formula bar, search, grid, status bar, and export controls.
- `SpreadsheetRef` supports `focus`, `scrollToCell`, `getSelectedData`, `getData`, `setData`, `exportToCSV`, `exportToXLSX`, `undo`, and `redo`.
- Callback props: `onCellChange`, `onSelectionChange`, `onSort`, `onFilter`, `onExport`.
- Each column menu includes freeform Excel-style filtering: plain column search plus expression filters such as `>100 && <500`, `contains(alpha)`, `blank()`, `in(open,closed)`, or `regex(^A)`.

## Storybook

```bash
npm run storybook
```
