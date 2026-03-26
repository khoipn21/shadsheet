import { useRef, useEffect, useCallback } from "react";
import type { CellEditorProps } from "@/types/spreadsheet-types";
import { FormulaReferenceInput } from "../formula-reference-input";

export function NumberEditor({ value, onChange, onCommit, onCancel }: CellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw.startsWith("=")) {
        onChange(raw);
        return;
      }
      // Allow empty string while typing, parse on commit
      if (raw === "" || raw === "-") {
        onChange(raw);
        return;
      }
      const num = Number(raw);
      onChange(Number.isNaN(num) ? raw : num);
    },
    [onChange],
  );

  return (
    <FormulaReferenceInput
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className="w-full h-full bg-background border-2 border-primary"
      contentClassName="w-full h-full px-1.5 text-sm"
      overlayClassName="flex items-center"
      inputClassName="px-1.5 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      value={value == null ? "" : String(value)}
      onChange={handleChange}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
    />
  );
}
