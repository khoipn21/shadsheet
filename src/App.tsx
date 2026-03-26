import { useMemo, useState, useCallback } from "react";
import { SpreadsheetProvider } from "./components/spreadsheet/spreadsheet-provider";
import { SpreadsheetGrid } from "./components/spreadsheet/spreadsheet-grid";
import { FormulaBar } from "./components/spreadsheet/formula-bar";
import { Toolbar } from "./components/spreadsheet/toolbar";
import { GlobalSearchFilter } from "./components/spreadsheet/global-search-filter";
import { generateDemoData, generateDemoColumns, generateDemoColumnConfigs } from "./lib/generate-demo-data";
import type { CellValue } from "./types/spreadsheet-types";

const ROW_COUNT = 50_000;
const COL_COUNT = 50;

export default function App() {
  const [data, setData] = useState(() => generateDemoData(ROW_COUNT, COL_COUNT));
  const columns = useMemo(() => generateDemoColumns(COL_COUNT), []);
  const columnConfigs = useMemo(() => generateDemoColumnConfigs(COL_COUNT), []);

  const handleDataChange = useCallback(
    (rowIndex: number, columnId: string, value: CellValue) => {
      setData((prev) => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], [columnId]: value };
        return next;
      });
    },
    [],
  );

  return (
    <div className="flex flex-col h-screen p-4 gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Spreadsheet Demo ({ROW_COUNT.toLocaleString()} rows × {COL_COUNT} cols)
        </h1>
      </div>

      <SpreadsheetProvider
        data={data}
        columns={columns}
        columnConfigs={columnConfigs}
        onDataChange={handleDataChange}
      >
        <Toolbar columns={columnConfigs} />
        <FormulaBar />
        <div className="flex items-center gap-2 mb-1">
          <GlobalSearchFilter />
        </div>
        <SpreadsheetGrid className="flex-1 min-h-0" />
      </SpreadsheetProvider>
    </div>
  );
}
