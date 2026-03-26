import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spreadsheet } from "../src";
import { generateDemoColumnConfigs, generateDemoData } from "../src/lib/generate-demo-data";
import type { CellValue, ColumnConfig } from "../src/types/spreadsheet-types";

type DemoRow = Record<string, CellValue>;

const baseColumns: ColumnConfig<DemoRow>[] = [
  { id: "A", header: "Name", editable: true, sortable: true, width: 180 },
  { id: "B", header: "Amount", type: "number", editable: true, width: 140 },
  { id: "C", header: "Active", type: "checkbox", editable: true, width: 120 },
];

const baseData: DemoRow[] = [
  { A: "Alpha", B: 120, C: true },
  { A: "Beta", B: 80, C: false },
  { A: "Gamma", B: 220, C: true },
];

const formulaData: DemoRow[] = [
  { A: "North", B: 100, C: "=B1*1.1" },
  { A: "South", B: 250, C: "=B2*1.1" },
  { A: "West", B: 180, C: "=B3*1.1" },
];

const treeData = [
  {
    A: "Accounts",
    B: 0,
    C: true,
    children: [
      { A: "Receivables", B: 420, C: true },
      { A: "Payables", B: 180, C: false },
    ],
  },
  {
    A: "Revenue",
    B: 0,
    C: true,
    children: [{ A: "Subscriptions", B: 1200, C: true }],
  },
];

const meta = {
  title: "ShadSheet/Spreadsheet",
  component: Spreadsheet,
  args: {
    data: baseData,
    columns: baseColumns,
    exportFileName: "storybook-grid",
  },
  render: (args) => (
    <div className="h-screen p-6 bg-background">
      <Spreadsheet {...args} />
    </div>
  ),
} satisfies Meta<typeof Spreadsheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ReadOnly: Story = {
  args: {
    editable: false,
    showFormulaBar: false,
  },
};

export const LargeDataset: Story = {
  args: {
    data: generateDemoData(50_000, 50),
    columns: generateDemoColumnConfigs(50),
  },
};

export const Formulas: Story = {
  args: {
    data: formulaData,
    columns: [
      { id: "A", header: "Region", editable: true },
      { id: "B", header: "Value", type: "number", editable: true },
      { id: "C", header: "Forecast", editable: true },
    ],
  },
};

export const ColumnFeatures: Story = {
  args: {
    pinnedColumns: { left: ["A"], right: ["C"] },
    sortable: true,
    resizableColumns: true,
  },
};

export const TreeRows: Story = {
  args: {
    data: treeData,
    columns: baseColumns,
    getSubRows: (row) => row.children as DemoRow[] | undefined,
  },
};

export const DarkTheme: Story = {
  args: {
    theme: "dark",
  },
};
