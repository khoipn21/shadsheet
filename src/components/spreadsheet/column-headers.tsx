import { useCallback, useContext, useEffect, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, type Header } from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableContext } from "./spreadsheet-provider";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import { useColumnResize } from "@/hooks/use-column-resize";
import { ColumnHeaderMenu } from "./column-header-menu";
import type { CellValue, SpreadsheetTableMeta } from "@/types/spreadsheet-types";

const DEFAULT_COL_WIDTH = 120;
const COL_OVERSCAN = 2;
const HEADER_HEIGHT = 36;

export function ColumnHeaders({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const table = useContext(TableContext);
  if (!table) throw new Error("ColumnHeaders must be used within SpreadsheetProvider");

  const meta = table.options.meta as SpreadsheetTableMeta | undefined;
  const allowResize = meta?.featureFlags.resizableColumns !== false;

  // Subscribe to store slices that change header layout or state.
  void useSpreadsheetStore((s) => s.columns);
  void useSpreadsheetStore((s) => s.sorting);
  void useSpreadsheetStore((s) => s.columnOrder);
  const columnResizePreview = useSpreadsheetStore((s) => s.columnResizePreview);
  void useSpreadsheetStore((s) => s.columnPinning);
  void useSpreadsheetStore((s) => s.columnVisibility);

  const updateColumnWidth = useSpreadsheetStore((s) => s.updateColumnWidth);
  const setColumnResizePreview = useSpreadsheetStore((s) => s.setColumnResizePreview);
  const getColumnWidth = useCallback(
    (columnId: string, fallbackWidth: number) =>
      columnResizePreview[columnId] ?? fallbackWidth,
    [columnResizePreview],
  );
  const { handleResizeStart, handleAutoFit } = useColumnResize({
    onResize: (columnId, width) => {
      setColumnResizePreview(columnId, width);
    },
    onResizeEnd: (columnId, width) => {
      table.setColumnSizing((prev) => ({ ...prev, [columnId]: width }));
      updateColumnWidth(columnId, width);
      setColumnResizePreview(columnId, null);
    },
  });

  const leftHeaders = table.getLeftHeaderGroups()[0]?.headers ?? [];
  const centerHeaders = table.getCenterHeaderGroups()[0]?.headers ?? [];
  const rightHeaders = table.getRightHeaderGroups()[0]?.headers ?? [];
  const centerColumns = table.getCenterVisibleLeafColumns();

  const colVirtualizer = useVirtualizer({
    count: centerColumns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const column = centerColumns[index];
        if (!column) return DEFAULT_COL_WIDTH;
        return getColumnWidth(column.id, column.getSize() ?? DEFAULT_COL_WIDTH);
      },
      [centerColumns, getColumnWidth],
    ),
    horizontal: true,
    overscan: COL_OVERSCAN,
  });

  const virtualCols = colVirtualizer.getVirtualItems();
  const totalCenterWidth = colVirtualizer.getTotalSize();
  const leftWidth = leftHeaders.reduce(
    (sum, header) => sum + getColumnWidth(header.column.id, header.getSize()),
    0,
  );
  const rightWidth = rightHeaders.reduce(
    (sum, header) => sum + getColumnWidth(header.column.id, header.getSize()),
    0,
  );
  const centerColumnSizeKey = centerColumns
    .map((column) => `${column.id}:${getColumnWidth(column.id, column.getSize())}`)
    .join("|");

  useEffect(() => {
    colVirtualizer.measure();
  }, [centerColumnSizeKey, colVirtualizer]);

  return (
    <div className="sticky top-0 z-10 flex border-b border-border bg-muted/50" role="row">
      {leftHeaders.length > 0 && (
        <div className="sticky left-0 z-[6] flex bg-muted/50" style={{ width: leftWidth, flexShrink: 0 }}>
          {leftHeaders.map((header) => (
            <HeaderCell
              key={header.id}
              header={header}
              currentWidth={getColumnWidth(header.column.id, header.getSize())}
              allowResize={allowResize}
              onAutoFit={(columnId) => handleAutoFit(columnId, scrollRef.current)}
              onResizeStart={handleResizeStart}
            />
          ))}
        </div>
      )}

      <div
        style={{ width: totalCenterWidth, position: "relative", height: HEADER_HEIGHT, flexShrink: 0 }}
      >
        {virtualCols.map((virtualCol) => {
          const header = centerHeaders[virtualCol.index];
          if (!header) return null;

          return (
            <HeaderCell
              key={header.id}
              header={header}
              currentWidth={getColumnWidth(header.column.id, virtualCol.size)}
              allowResize={allowResize}
              onAutoFit={(columnId) => handleAutoFit(columnId, scrollRef.current)}
              onResizeStart={handleResizeStart}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: getColumnWidth(header.column.id, virtualCol.size),
                transform: `translateX(${virtualCol.start}px)`,
              }}
            />
          );
        })}
      </div>

      {rightHeaders.length > 0 && (
        <div className="sticky right-0 z-[6] flex bg-muted/50" style={{ width: rightWidth, flexShrink: 0 }}>
          {rightHeaders.map((header) => (
            <HeaderCell
              key={header.id}
              header={header}
              currentWidth={getColumnWidth(header.column.id, header.getSize())}
              allowResize={allowResize}
              onAutoFit={(columnId) => handleAutoFit(columnId, scrollRef.current)}
              onResizeStart={handleResizeStart}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HeaderCell({
  header,
  currentWidth,
  allowResize,
  onAutoFit,
  onResizeStart,
  style,
}: {
  header: Header<Record<string, CellValue>, unknown>;
  currentWidth: number;
  allowResize: boolean;
  onAutoFit: (columnId: string) => void;
  onResizeStart: (e: React.MouseEvent, columnId: string, currentWidth: number) => void;
  style?: CSSProperties;
}) {
  const canSort = header.column.getCanSort();
  const sorted = header.column.getIsSorted();

  return (
    <div
      role="columnheader"
      data-col-id={header.column.id}
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
      className="group relative flex h-9 items-center gap-1 border-r border-border px-2 text-sm font-medium select-none"
      style={{ ...style, width: style?.width ?? currentWidth }}
    >
      <button
        type="button"
        className="flex-1 truncate bg-transparent p-0 text-left text-sm font-medium"
        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
        aria-label={
          canSort
            ? `Sort by ${
                typeof header.column.columnDef.header === "string"
                  ? header.column.columnDef.header
                  : header.id
              }`
            : undefined
        }
      >
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
      </button>

      {canSort && (
        <span className="shrink-0">
          {sorted === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : sorted === "desc" ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
          )}
        </span>
      )}

      <ColumnHeaderMenu column={header.column} onAutoFit={onAutoFit} allowResize={allowResize} />

      {allowResize && (
        <div
          role="separator"
          aria-label="Resize column"
          aria-orientation="vertical"
          className="absolute top-0 right-0 h-full w-2 cursor-col-resize transition-colors hover:bg-primary/30"
          onMouseDown={(e) => onResizeStart(e, header.column.id, currentWidth)}
          onDoubleClick={() => onAutoFit(header.column.id)}
        />
      )}
    </div>
  );
}
