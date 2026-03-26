import { useContext, useCallback, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { flexRender, type Header } from "@tanstack/react-table";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUp, ArrowDown, ArrowUpDown, GripVertical } from "lucide-react";
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
  const headerColumns = useSpreadsheetStore((s) => s.columns);
  const headerSorting = useSpreadsheetStore((s) => s.sorting);
  const headerColumnOrder = useSpreadsheetStore((s) => s.columnOrder);
  const headerColumnPinning = useSpreadsheetStore((s) => s.columnPinning);
  const headerColumnVisibility = useSpreadsheetStore((s) => s.columnVisibility);

  const setColumnOrder = useSpreadsheetStore((s) => s.setColumnOrder);
  const updateColumnWidth = useSpreadsheetStore((s) => s.updateColumnWidth);
  const allowResize = meta?.featureFlags.resizableColumns !== false;
  const allowReorder = meta?.featureFlags.reorderableColumns !== false;
  void headerColumns;
  void headerSorting;
  void headerColumnOrder;
  void headerColumnPinning;
  void headerColumnVisibility;

  const { handleResizeStart, handleAutoFit } = useColumnResize({
    onResizeEnd: (columnId, width) => {
      updateColumnWidth(columnId, width);
      table.setColumnSizing((prev) => ({ ...prev, [columnId]: width }));
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
      (index: number) => centerColumns[index]?.getSize() ?? DEFAULT_COL_WIDTH,
      [centerColumns],
    ),
    horizontal: true,
    overscan: COL_OVERSCAN,
  });

  const virtualCols = colVirtualizer.getVirtualItems();
  const totalCenterWidth = colVirtualizer.getTotalSize();

  // dnd-kit state
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columnIds = table.getVisibleLeafColumns().map((c) => c.id);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!allowReorder) return;
    setActiveId(event.active.id as string);
  }, [allowReorder]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    if (!allowReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columnIds.indexOf(active.id as string);
    const newIndex = columnIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = [...columnIds];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, active.id as string);
      setColumnOrder(newOrder);
    }, [allowReorder, columnIds, setColumnOrder]);

  const activeHeader = activeId
    ? [...leftHeaders, ...centerHeaders, ...rightHeaders].find((h) => h.id === activeId)
    : null;

  // Widths for pinned panes
  const leftWidth = leftHeaders.reduce((sum, h) => sum + h.getSize(), 0);
  const rightWidth = rightHeaders.reduce((sum, h) => sum + h.getSize(), 0);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="sticky top-0 z-10 border-b border-border bg-muted/50 flex" role="row">
        {/* Left pinned headers */}
        {leftHeaders.length > 0 && (
          <div className="sticky left-0 z-[6] bg-muted/50 flex" style={{ width: leftWidth, flexShrink: 0 }}>
            <SortableContext items={leftHeaders.map((h) => h.id)} strategy={horizontalListSortingStrategy}>
              {leftHeaders.map((header) => (
                <SortableHeader
                  key={header.id}
                    header={header}
                    onResizeStart={handleResizeStart}
                    onAutoFit={(colId) => handleAutoFit(colId, scrollRef.current)}
                    allowResize={allowResize}
                    allowReorder={allowReorder}
                  />
                ))}
            </SortableContext>
          </div>
        )}

        {/* Center virtualized headers */}
        <div style={{ width: totalCenterWidth, position: "relative", height: HEADER_HEIGHT, flexShrink: 0 }}>
          <SortableContext items={centerHeaders.map((h) => h.id)} strategy={horizontalListSortingStrategy}>
            {virtualCols.map((virtualCol) => {
              const header = centerHeaders[virtualCol.index];
              if (!header) return null;
              return (
                <SortableHeader
                  key={header.id}
                  header={header}
                  onResizeStart={handleResizeStart}
                    onAutoFit={(colId) => handleAutoFit(colId, scrollRef.current)}
                    allowResize={allowResize}
                    allowReorder={allowReorder}
                    style={{
                      position: "absolute",
                    top: 0,
                    left: 0,
                    width: virtualCol.size,
                    transform: `translateX(${virtualCol.start}px)`,
                  }}
                />
              );
            })}
          </SortableContext>
        </div>

        {/* Right pinned headers */}
        {rightHeaders.length > 0 && (
          <div className="sticky right-0 z-[6] bg-muted/50 flex" style={{ width: rightWidth, flexShrink: 0 }}>
            <SortableContext items={rightHeaders.map((h) => h.id)} strategy={horizontalListSortingStrategy}>
              {rightHeaders.map((header) => (
                <SortableHeader
                  key={header.id}
                    header={header}
                    onResizeStart={handleResizeStart}
                    onAutoFit={(colId) => handleAutoFit(colId, scrollRef.current)}
                    allowResize={allowResize}
                    allowReorder={allowReorder}
                  />
                ))}
            </SortableContext>
          </div>
        )}
      </div>

      {/* Drag overlay — renders ghost header at 50% opacity */}
      <DragOverlay>
          {activeHeader ? (
          <div
            className="flex items-center gap-1 border-r border-border px-2 text-sm font-medium bg-muted/80 h-9 opacity-50 rounded shadow-md"
            style={{ width: activeHeader.getSize() }}
          >
            {flexRender(activeHeader.column.columnDef.header, activeHeader.getContext())}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Single sortable column header with resize handle */
function SortableHeader({
  header,
  onResizeStart,
  onAutoFit,
  allowResize,
  allowReorder,
  style,
}: {
  header: Header<Record<string, CellValue>, unknown>;
  onResizeStart: (e: React.MouseEvent, columnId: string, currentWidth: number) => void;
  onAutoFit: (columnId: string) => void;
  allowResize: boolean;
  allowReorder: boolean;
  style?: React.CSSProperties;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: header.id });

  const canSort = header.column.getCanSort();
  const sorted = header.column.getIsSorted();
  const dragTransform = CSS.Translate.toString(transform);
  const composedTransform = [style?.transform, dragTransform].filter(Boolean).join(" ");

  const sortableStyle: React.CSSProperties = {
    ...style,
    transform: composedTransform || undefined,
    transition,
    opacity: isDragging ? 0.3 : 1,
    width: style?.width ?? header.getSize(),
    height: HEADER_HEIGHT,
  };

  return (
    <div
      ref={setNodeRef}
      role="columnheader"
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
      className="flex items-center gap-1 border-r border-border px-2 text-sm font-medium select-none relative group"
      style={sortableStyle}
    >
      {/* Drag handle */}
      {allowReorder && (
        <span {...attributes} {...listeners} className="cursor-grab shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" aria-label="Drag to reorder column">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}

      {/* Header label — click to sort */}
      <button
        type="button"
        className="truncate flex-1 cursor-pointer bg-transparent border-0 p-0 text-left text-sm font-medium"
        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
        aria-label={canSort ? `Sort by ${typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.id}` : undefined}
      >
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
      </button>

      {/* Sort indicator */}
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

      {/* Column menu */}
        <ColumnHeaderMenu column={header.column} onAutoFit={onAutoFit} allowResize={allowResize} />

        {/* Resize handle */}
        {allowResize && (
          <div
            role="separator"
            aria-label="Resize column"
            aria-orientation="vertical"
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 transition-colors"
            onMouseDown={(e) => onResizeStart(e, header.column.id, header.getSize())}
            onDoubleClick={() => onAutoFit(header.column.id)}
          />
        )}
      </div>
    );
  }
