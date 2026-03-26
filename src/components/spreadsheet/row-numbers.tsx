/* eslint-disable react-refresh/only-export-components */
import { useCallback } from "react";
import {
  createColumnHelper,
  type CellContext,
  type HeaderContext,
} from "@tanstack/react-table";
import type { CellValue } from "@/types/spreadsheet-types";

type RowData = Record<string, CellValue>;
const columnHelper = createColumnHelper<RowData>();

const ROW_NUMBER_WIDTH = 52;

/** Tri-state header checkbox: none / some / all selected. */
function SelectAllHeader({
  table,
  selectable,
}: HeaderContext<RowData, unknown> & { selectable: boolean }) {
  if (!selectable) {
    return (
      <div className="flex items-center justify-center w-full text-xs text-muted-foreground">
        #
      </div>
    );
  }

  const isAllSelected = table.getIsAllRowsSelected();
  const isSomeSelected = table.getIsSomeRowsSelected();

  return (
    <div className="flex items-center justify-center w-full">
      <input
        type="checkbox"
        checked={isAllSelected}
        ref={(el) => {
          if (el) el.indeterminate = isSomeSelected && !isAllSelected;
        }}
        onChange={table.getToggleAllRowsSelectedHandler()}
        className="h-3.5 w-3.5 cursor-pointer accent-primary"
        aria-label="Select all rows"
      />
    </div>
  );
}

/** Row number + optional row selection checkbox. */
function RowNumberCell({
  row,
  selectable,
}: CellContext<RowData, unknown> & { selectable: boolean }) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      row.getToggleSelectedHandler()(e);
    },
    [row],
  );

  if (!selectable) {
    return (
      <div className="flex items-center justify-center w-full">
        <span className="text-xs text-muted-foreground select-none tabular-nums">
          {row.index + 1}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 w-full group">
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={handleChange}
        className="h-3.5 w-3.5 cursor-pointer accent-primary opacity-0 group-hover:opacity-100 data-[checked=true]:opacity-100"
        data-checked={row.getIsSelected() || undefined}
        aria-label={`Select row ${row.index + 1}`}
      />
      <span className="text-xs text-muted-foreground select-none tabular-nums group-hover:hidden">
        {row.index + 1}
      </span>
    </div>
  );
}

/** Creates the row-number column and optionally enables row selection UI. */
export function createRowSelectionColumn(selectable = true) {
  return columnHelper.display({
    id: "_row_number",
    header: (context) => <SelectAllHeader {...context} selectable={selectable} />,
    cell: (context) => <RowNumberCell {...context} selectable={selectable} />,
    size: ROW_NUMBER_WIDTH,
    minSize: ROW_NUMBER_WIDTH,
    maxSize: ROW_NUMBER_WIDTH,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
    enablePinning: false,
  });
}
