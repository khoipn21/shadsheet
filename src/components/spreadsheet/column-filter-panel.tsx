import { useEffect, useMemo, useState } from "react";
import type { Column } from "@tanstack/react-table";
import { Search, Funnel, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type {
  CellValue,
  SpreadsheetColumnFilterValue,
} from "@/types/spreadsheet-types";
import {
  isColumnFilterActive,
  normalizeColumnFilterValue,
} from "@/utils/column-filter-utils";

const DEBOUNCE_MS = 180;

interface ColumnFilterPanelProps {
  column: Column<Record<string, CellValue>, unknown>;
  className?: string;
}

export function ColumnFilterPanel({
  column,
  className,
}: ColumnFilterPanelProps) {
  const rawFilterValue = column.getFilterValue();
  const filterValue = useMemo(
    () => normalizeColumnFilterValue(rawFilterValue),
    [rawFilterValue],
  );
  const [localFilter, setLocalFilter] =
    useState<SpreadsheetColumnFilterValue>(filterValue);

  useEffect(() => {
    setLocalFilter(filterValue);
  }, [filterValue]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      column.setFilterValue(
        isColumnFilterActive(localFilter) ? localFilter : undefined,
      );
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [column, localFilter]);

  return (
    <div
      className={`space-y-3 rounded-md border border-border/70 bg-muted/20 p-3 ${className ?? ""}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Funnel className="h-3.5 w-3.5" />
          Filter This Column
        </div>
        {isColumnFilterActive(localFilter) && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setLocalFilter({ search: "", expression: "" });
              column.setFilterValue(undefined);
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Search values</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={localFilter.search}
            onChange={(event) =>
              setLocalFilter((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder="Contains text in this column..."
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          Expression mode
        </label>
        <Input
          value={localFilter.expression}
          onChange={(event) =>
            setLocalFilter((current) => ({
              ...current,
              expression: event.target.value,
            }))
          }
          placeholder="Examples: >100 && <500, contains(alpha), blank()"
          className="h-8 text-sm"
        />
        <p className="text-[11px] leading-4 text-muted-foreground">
          Supports `=`, `!=`, `&gt;`, `&lt;`, `&gt;=`, `&lt;=`, `contains()`,
          `startsWith()`, `endsWith()`, `between()`, `in()`, `blank()`,
          `regex()`, plus `&&` and `||`.
        </p>
      </div>
    </div>
  );
}
