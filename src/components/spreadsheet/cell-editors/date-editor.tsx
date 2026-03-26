import { useRef, useEffect, useCallback } from "react";
import type { CellEditorProps } from "@/types/spreadsheet-types";

/** Format a value to YYYY-MM-DD for the date input (local timezone, no UTC drift) */
function toDateString(value: unknown): string {
  if (!value) return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = value instanceof Date ? value : new Date(str);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateEditor({ value, onChange, onCommit, onCancel }: CellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommit();
      } else if (e.key === "Escape") {
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
    <input
      ref={inputRef}
      type="date"
      className="w-full h-full bg-background border-2 border-primary px-1.5 text-sm outline-none"
      value={toDateString(value)}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
    />
  );
}
