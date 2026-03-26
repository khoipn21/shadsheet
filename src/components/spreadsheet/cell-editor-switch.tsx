import type { CellEditorProps } from "@/types/spreadsheet-types";
import { TextEditor } from "./cell-editors/text-editor";
import { NumberEditor } from "./cell-editors/number-editor";
import { DateEditor } from "./cell-editors/date-editor";
import { SelectEditor } from "./cell-editors/select-editor";
import { CheckboxEditor } from "./cell-editors/checkbox-editor";

/** Routes to the correct editor component based on column type */
export function CellEditorSwitch(props: CellEditorProps) {
  const type = props.columnConfig.type ?? "text";

  switch (type) {
    case "number":
      return <NumberEditor {...props} />;
    case "date":
      return <DateEditor {...props} />;
    case "select":
      return <SelectEditor {...props} />;
    case "checkbox":
      return <CheckboxEditor {...props} />;
    default:
      return <TextEditor {...props} />;
  }
}
