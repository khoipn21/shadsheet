import type { Column } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpAZ,
  ArrowDownZA,
  PinIcon,
  PinOffIcon,
  EyeOffIcon,
  ChevronsLeftRightEllipsis,
  ChevronDown,
} from "lucide-react";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";
import type { CellValue } from "@/types/spreadsheet-types";

interface ColumnHeaderMenuProps {
  column: Column<Record<string, CellValue>, unknown>;
  onAutoFit: (columnId: string) => void;
}

export function ColumnHeaderMenu({ column, onAutoFit }: ColumnHeaderMenuProps) {
  const pinColumn = useSpreadsheetStore((s) => s.pinColumn);
  const toggleColumnVisibility = useSpreadsheetStore((s) => s.toggleColumnVisibility);

  const isPinnedLeft = column.getIsPinned() === "left";
  const isPinnedRight = column.getIsPinned() === "right";
  const canSort = column.getCanSort();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="shrink-0 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {/* Sort options */}
        {canSort && (
          <>
            <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
              <ArrowUpAZ className="mr-2 h-4 w-4" />
              Sort Ascending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
              <ArrowDownZA className="mr-2 h-4 w-4" />
              Sort Descending
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Pin options */}
        {!isPinnedLeft && (
          <DropdownMenuItem onClick={() => pinColumn(column.id, "left")}>
            <PinIcon className="mr-2 h-4 w-4" />
            Pin Left
          </DropdownMenuItem>
        )}
        {!isPinnedRight && (
          <DropdownMenuItem onClick={() => pinColumn(column.id, "right")}>
            <PinIcon className="mr-2 h-4 w-4 rotate-90" />
            Pin Right
          </DropdownMenuItem>
        )}
        {(isPinnedLeft || isPinnedRight) && (
          <DropdownMenuItem onClick={() => pinColumn(column.id, false)}>
            <PinOffIcon className="mr-2 h-4 w-4" />
            Unpin
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Auto-fit width */}
        <DropdownMenuItem onClick={() => onAutoFit(column.id)}>
          <ChevronsLeftRightEllipsis className="mr-2 h-4 w-4" />
          Auto-fit Width
        </DropdownMenuItem>

        {/* Hide column */}
        <DropdownMenuItem onClick={() => toggleColumnVisibility(column.id)}>
          <EyeOffIcon className="mr-2 h-4 w-4" />
          Hide Column
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
