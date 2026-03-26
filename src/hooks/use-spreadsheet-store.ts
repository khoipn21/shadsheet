import { useContext } from "react";
import { useStore } from "zustand";
import { SpreadsheetContext } from "@/components/spreadsheet/spreadsheet-provider";
import type { SpreadsheetStore } from "@/types/spreadsheet-types";

/**
 * Hook to select slices from the spreadsheet Zustand store.
 * Must be used within a SpreadsheetProvider.
 */
export function useSpreadsheetStore<T>(selector: (state: SpreadsheetStore) => T): T {
  const store = useContext(SpreadsheetContext);
  if (!store) {
    throw new Error("useSpreadsheetStore must be used within a SpreadsheetProvider");
  }
  return useStore(store, selector);
}
