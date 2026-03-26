import { useMemo, useRef } from "react";
import { Spreadsheet, type SpreadsheetRef } from "./index";
import { generateDemoData, generateDemoColumnConfigs } from "./lib/generate-demo-data";
import type { CellValue } from "./types/spreadsheet-types";

type DemoRow = Record<string, CellValue>;

const ROW_COUNT = 50_000;
const COL_COUNT = 50;

export default function App() {
  const spreadsheetRef = useRef<SpreadsheetRef<DemoRow>>(null);
  const data = useMemo(() => generateDemoData(ROW_COUNT, COL_COUNT), []);
  const columns = useMemo(() => generateDemoColumnConfigs(COL_COUNT), []);

  return (
    <div className="flex flex-col h-screen p-4 gap-3">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">
          Spreadsheet Demo ({ROW_COUNT.toLocaleString()} rows × {COL_COUNT} cols)
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
            onClick={() => spreadsheetRef.current?.scrollToCell(999, 25)}
          >
            Jump to Z1000
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
            onClick={() => spreadsheetRef.current?.exportToCSV()}
          >
            Export CSV
          </button>
        </div>
      </div>

      <Spreadsheet
        ref={spreadsheetRef}
        data={data}
        columns={columns}
        exportFileName="spreadsheet-demo"
        className="flex-1 min-h-0"
      />
    </div>
  );
}
