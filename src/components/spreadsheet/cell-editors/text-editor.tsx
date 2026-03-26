import { useRef, useEffect, useCallback } from "react";
import type { CellEditorProps } from "@/types/spreadsheet-types";
import { FormulaReferenceInput } from "../formula-reference-input";

export function TextEditor({ value, onChange, onCommit, onCancel }: CellEditorProps) {
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

  return (
    <FormulaReferenceInput
      ref={inputRef}
      type="text"
      className="w-full h-full bg-background border-2 border-primary"
      contentClassName="w-full h-full px-1.5 text-sm"
      overlayClassName="flex items-center"
      inputClassName="px-1.5 text-sm"
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
    />
  );
}
