import { useCallback } from "react";
import { flushSync } from "react-dom";
import type { CellEditorProps } from "@/types/spreadsheet-types";

/** Checkbox toggles immediately on click — no edit mode needed */
export function CheckboxEditor({ value, onChange, onCommit }: CellEditorProps) {
  const handleChange = useCallback(() => {
    // flushSync ensures the store update from onChange is visible to onCommit
    flushSync(() => {
      onChange(!value);
    });
    onCommit();
  }, [value, onChange, onCommit]);

  return (
    <div className="w-full h-full flex items-center justify-center border-2 border-primary bg-background">
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer accent-primary"
        checked={Boolean(value)}
        onChange={handleChange}
      />
    </div>
  );
}
