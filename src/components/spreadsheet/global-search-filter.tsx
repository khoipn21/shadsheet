import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useSpreadsheetStore } from "@/hooks/use-spreadsheet-store";

const DEBOUNCE_MS = 300;

interface GlobalSearchFilterProps {
  className?: string;
}

export function GlobalSearchFilter({ className }: GlobalSearchFilterProps) {
  const globalFilter = useSpreadsheetStore((s) => s.globalFilter);
  const setGlobalFilter = useSpreadsheetStore((s) => s.setGlobalFilter);
  const [localValue, setLocalValue] = useState(globalFilter);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(globalFilter);
  }, [globalFilter]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setGlobalFilter(val), DEBOUNCE_MS);
  };

  return (
    <div className={`relative w-64 ${className ?? ""}`}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={localValue}
        onChange={handleChange}
        placeholder="Search all columns..."
        className="pl-8 h-8 text-sm"
      />
    </div>
  );
}
