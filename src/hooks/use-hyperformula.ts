import { useContext } from "react";
import { HyperFormulaContext } from "@/components/spreadsheet/spreadsheet-provider";

/** Access the HyperFormula instance from context. Returns null while loading. */
export function useHyperFormula() {
  return useContext(HyperFormulaContext);
}
