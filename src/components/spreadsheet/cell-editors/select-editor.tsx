import { useRef, useEffect, useCallback } from "react";
import type { CellEditorProps } from "@/types/spreadsheet-types";

export function SelectEditor({ value, onChange, onCommit, onCancel, columnConfig }: CellEditorProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const options = columnConfig.options ?? [];

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Tab") {
        e.preventDefault();
        onCommit();
      }
    },
    [onCommit, onCancel],
  );

  return (
    <select
      ref={selectRef}
      className="w-full h-full bg-background border-2 border-primary px-1 text-sm outline-none cursor-pointer"
      value={value == null ? "" : String(value)}
      onChange={(e) => {
        onChange(e.target.value);
        // Auto-commit on selection for single-select
        onCommit();
      }}
      onKeyDown={handleKeyDown}
    >
      <option value="">—</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
