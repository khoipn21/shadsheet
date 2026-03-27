import React, { useState, useRef } from "react";
import {
  Zap,
  Copy,
  Check,
  Moon,
  Sun,
  Layers,
  Keyboard,
  Filter,
  BarChart3,
  FileSpreadsheet,
  Box,
  BookOpen,
  ArrowUpRight,
  Terminal,
  Grid3X3,
  Hash,
  type LucideIcon,
} from "lucide-react";
import {
  Spreadsheet,
  type SpreadsheetRef,
  type ColumnConfig,
} from "./index";

// ============================================================
// CONSTANTS - Easy to change links
// ============================================================
const LINKS = {
  docs: "https://khoipn21.mintlify.app/",
  storybook: "https://shadsheet.vercel.app/",
  github: "https://github.com/khoipn21/shadsheet",
  npm: "https://www.npmjs.com/package/@khoipn2112/shadsheet",
} as const;

const VERSION = "v0.3.0";

// ============================================================
// DEMO DATA
// ============================================================
type DemoRow = Record<string, string | number | boolean>;

const demoData: DemoRow[] = [
  { company: "Acme Corp", revenue: 125000, growth: 23.5, status: "Active", premium: true },
  { company: "Beta Inc", revenue: 89000, growth: 15.2, status: "Active", premium: false },
  { company: "Gamma LLC", revenue: 234000, growth: 45.8, status: "Active", premium: true },
  { company: "Delta Co", revenue: 67000, growth: -5.3, status: "Inactive", premium: false },
  { company: "Epsilon Ltd", revenue: 178000, growth: 12.1, status: "Active", premium: true },
  { company: "Zeta Corp", revenue: 92000, growth: 8.7, status: "Active", premium: false },
  { company: "Eta Systems", revenue: 156000, growth: 31.2, status: "Active", premium: true },
  { company: "Theta Labs", revenue: 203000, growth: 28.9, status: "Active", premium: true },
  { company: "Iota Tech", revenue: 145000, growth: 18.4, status: "Active", premium: false },
  { company: "Kappa Inc", revenue: 98000, growth: -2.1, status: "Inactive", premium: false },
];

const demoColumns: ColumnConfig<DemoRow>[] = [
  { id: "company", header: "Company", width: 140 },
  { id: "revenue", header: "Revenue ($)", width: 130, type: "number" },
  { id: "growth", header: "Growth (%)", width: 110, type: "number" },
  { id: "status", header: "Status", width: 100 },
  { id: "premium", header: "Premium", width: 90, type: "checkbox" },
];

// ============================================================
// FEATURES
// ============================================================
const features: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Zap,
    title: "Virtualized Rendering",
    description: "100,000+ rows. 60fps scrolling. TanStack Virtual powers the grid.",
  },
  {
    icon: Layers,
    title: "Pinned Columns",
    description: "Lock columns left or right. Keep key data visible while scrolling.",
  },
  {
    icon: FileSpreadsheet,
    title: "Formula Engine",
    description: "HyperFormula-backed. Excel-compatible formulas with live calculation.",
  },
  {
    icon: Keyboard,
    title: "Keyboard Navigation",
    description: "Arrow keys, Tab, Enter, Ctrl+C/V. Familiar spreadsheet shortcuts.",
  },
  {
    icon: Filter,
    title: "Advanced Filtering",
    description: "Per-column filters with expression support. Range, text, custom rules.",
  },
  {
    icon: BarChart3,
    title: "Export CSV/XLSX",
    description: "One-click export. Excel or CSV. Formulas or raw data.",
  },
];

// ============================================================
// CODE EXAMPLE WITH SYNTAX HIGHLIGHTING
// ============================================================
const codeExample = `import { Spreadsheet, type ColumnConfig } from "@khoipn2112/shadsheet";

type Row = { name: string; amount: number; active: boolean };

const columns: ColumnConfig<Row>[] = [
  { id: "name", header: "Name", editable: true, width: 180 },
  { id: "amount", header: "Amount", type: "number", editable: true },
  { id: "active", header: "Active", type: "checkbox", editable: true },
];

function App() {
  return (
    <div style={{ height: 500 }}>
      <Spreadsheet data={data} columns={columns} />
    </div>
  );
}`;

// Simple syntax highlighter for TypeScript/TSX
function highlightCode(code: string, isDark: boolean): React.ReactNode {
  const colors = isDark
    ? {
        keyword: "text-purple-400",
        type: "text-cyan-400",
        string: "text-amber-300",
        number: "text-emerald-400",
        comment: "text-slate-500",
        function: "text-blue-400",
        property: "text-slate-300",
        operator: "text-slate-400",
        bracket: "text-slate-300",
        plain: "text-slate-300",
      }
    : {
        keyword: "text-purple-700",
        type: "text-cyan-700",
        string: "text-amber-700",
        number: "text-emerald-700",
        comment: "text-slate-500",
        function: "text-blue-700",
        property: "text-slate-700",
        operator: "text-slate-600",
        bracket: "text-slate-600",
        plain: "text-slate-700",
      };

  const keywords = ["import", "export", "from", "const", "type", "function", "return", "true", "false"];
  const types = ["string", "number", "boolean", "ColumnConfig", "Spreadsheet", "Row", "App"];

  const lines = code.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    // Process each line
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let tokenKey = 0;

    // Simple tokenization
    while (remaining.length > 0) {
      let matched = false;

      // Comments
      if (remaining.startsWith("//")) {
        tokens.push(
          <span key={tokenKey++} className={colors.comment}>
            {remaining}
          </span>
        );
        remaining = "";
        matched = true;
      }

      // Strings
      if (!matched && (remaining.startsWith('"') || remaining.startsWith("'"))) {
        const quote = remaining[0];
        const endIdx = remaining.indexOf(quote, 1);
        if (endIdx > 0) {
          const str = remaining.slice(0, endIdx + 1);
          tokens.push(
            <span key={tokenKey++} className={colors.string}>
              {str}
            </span>
          );
          remaining = remaining.slice(endIdx + 1);
          matched = true;
        }
      }

      // Keywords and types
      if (!matched) {
        for (const kw of [...keywords, ...types]) {
          if (remaining.startsWith(kw) && !/[a-zA-Z0-9_]/.test(remaining[kw.length] || "")) {
            const isType = types.includes(kw);
            tokens.push(
              <span key={tokenKey++} className={isType ? colors.type : colors.keyword}>
                {kw}
              </span>
            );
            remaining = remaining.slice(kw.length);
            matched = true;
            break;
          }
        }
      }

      // Numbers
      if (!matched && /\d/.test(remaining[0])) {
        const match = remaining.match(/^(\d+)/);
        if (match) {
          tokens.push(
            <span key={tokenKey++} className={colors.number}>
              {match[0]}
            </span>
          );
          remaining = remaining.slice(match[0].length);
          matched = true;
        }
      }

      // Brackets and operators
      if (!matched && /[{}()\[\];:,.<>]/.test(remaining[0])) {
        tokens.push(
          <span key={tokenKey++} className={colors.bracket}>
            {remaining[0]}
          </span>
        );
        remaining = remaining.slice(1);
        matched = true;
      }

      // Identifiers (properties, function names)
      if (!matched && /[a-zA-Z_]/.test(remaining[0])) {
        const match = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (match) {
          tokens.push(
            <span key={tokenKey++} className={colors.property}>
              {match[0]}
            </span>
          );
          remaining = remaining.slice(match[0].length);
          matched = true;
        }
      }

      // Whitespace or other
      if (!matched) {
        const match = remaining.match(/^(\s+|.)/);
        if (match) {
          tokens.push(
            <span key={tokenKey++} className={colors.plain}>
              {match[0]}
            </span>
          );
          remaining = remaining.slice(match[0].length);
        }
      }
    }

    elements.push(
      <div key={lineIndex}>
        {tokens}
      </div>
    );
  });

  return elements;
}

// ============================================================
// THEME DEFINITIONS - CSS custom properties for spreadsheet
// ============================================================
type ThemeName = "white" | "mint" | "slate" | "amber" | "rose";

const themes: Record<ThemeName, {
  label: string;
  labelColor: string;
  pageBg: string;
  pageBorder: string;
  pageAccent: string;
  isDark: boolean;
  cssVars: Record<string, string>;
}> = {
  white: {
    label: "White",
    labelColor: "text-slate-600",
    pageBg: "bg-white",
    pageBorder: "border-slate-300",
    pageAccent: "text-slate-600",
    isDark: false,
    cssVars: {
      "--background": "oklch(1 0 0)",
      "--foreground": "oklch(0.15 0 0)",
      "--card": "oklch(0.98 0 0)",
      "--card-foreground": "oklch(0.15 0 0)",
      "--border": "oklch(0.88 0 0)",
      "--input": "oklch(0.88 0 0)",
      "--primary": "oklch(0.25 0 0)",
      "--primary-foreground": "oklch(0.98 0 0)",
      "--secondary": "oklch(0.96 0 0)",
      "--secondary-foreground": "oklch(0.25 0 0)",
      "--muted": "oklch(0.96 0 0)",
      "--muted-foreground": "oklch(0.5 0 0)",
      "--accent": "oklch(0.94 0 0)",
      "--accent-foreground": "oklch(0.2 0 0)",
      "--ring": "oklch(0.5 0 0)",
    },
  },
  mint: {
    label: "Mint",
    labelColor: "text-emerald-400",
    pageBg: "bg-emerald-950",
    pageBorder: "border-emerald-800",
    pageAccent: "text-emerald-400",
    isDark: true,
    cssVars: {
      "--background": "oklch(0.1 0.02 160)",
      "--foreground": "oklch(0.95 0.02 160)",
      "--card": "oklch(0.15 0.02 160)",
      "--card-foreground": "oklch(0.95 0.02 160)",
      "--border": "oklch(0.28 0.03 160)",
      "--input": "oklch(0.22 0.02 160)",
      "--primary": "oklch(0.7 0.15 160)",
      "--primary-foreground": "oklch(0.1 0.02 160)",
      "--secondary": "oklch(0.22 0.02 160)",
      "--secondary-foreground": "oklch(0.9 0.02 160)",
      "--muted": "oklch(0.2 0.02 160)",
      "--muted-foreground": "oklch(0.6 0.02 160)",
      "--accent": "oklch(0.28 0.04 160)",
      "--accent-foreground": "oklch(0.95 0.02 160)",
      "--ring": "oklch(0.7 0.15 160)",
    },
  },
  slate: {
    label: "Slate",
    labelColor: "text-slate-300",
    pageBg: "bg-slate-950",
    pageBorder: "border-slate-700",
    pageAccent: "text-slate-300",
    isDark: true,
    cssVars: {
      "--background": "oklch(0.12 0 0)",
      "--foreground": "oklch(0.95 0 0)",
      "--card": "oklch(0.18 0 0)",
      "--card-foreground": "oklch(0.95 0 0)",
      "--border": "oklch(0.32 0 0)",
      "--input": "oklch(0.24 0 0)",
      "--primary": "oklch(0.7 0 0)",
      "--primary-foreground": "oklch(0.12 0 0)",
      "--secondary": "oklch(0.24 0 0)",
      "--secondary-foreground": "oklch(0.9 0 0)",
      "--muted": "oklch(0.22 0 0)",
      "--muted-foreground": "oklch(0.62 0 0)",
      "--accent": "oklch(0.3 0 0)",
      "--accent-foreground": "oklch(0.95 0 0)",
      "--ring": "oklch(0.6 0 0)",
    },
  },
  amber: {
    label: "Amber",
    labelColor: "text-amber-400",
    pageBg: "bg-amber-950",
    pageBorder: "border-amber-800",
    pageAccent: "text-amber-400",
    isDark: true,
    cssVars: {
      "--background": "oklch(0.14 0.04 70)",
      "--foreground": "oklch(0.95 0.02 70)",
      "--card": "oklch(0.2 0.04 70)",
      "--card-foreground": "oklch(0.95 0.02 70)",
      "--border": "oklch(0.36 0.05 70)",
      "--input": "oklch(0.28 0.04 70)",
      "--primary": "oklch(0.75 0.15 70)",
      "--primary-foreground": "oklch(0.15 0.04 70)",
      "--secondary": "oklch(0.28 0.04 70)",
      "--secondary-foreground": "oklch(0.9 0.02 70)",
      "--muted": "oklch(0.25 0.04 70)",
      "--muted-foreground": "oklch(0.62 0.02 70)",
      "--accent": "oklch(0.34 0.06 70)",
      "--accent-foreground": "oklch(0.95 0.02 70)",
      "--ring": "oklch(0.75 0.15 70)",
    },
  },
  rose: {
    label: "Rose",
    labelColor: "text-rose-400",
    pageBg: "bg-rose-950",
    pageBorder: "border-rose-800",
    pageAccent: "text-rose-400",
    isDark: true,
    cssVars: {
      "--background": "oklch(0.14 0.04 350)",
      "--foreground": "oklch(0.95 0.02 350)",
      "--card": "oklch(0.2 0.04 350)",
      "--card-foreground": "oklch(0.95 0.02 350)",
      "--border": "oklch(0.36 0.05 350)",
      "--input": "oklch(0.28 0.04 350)",
      "--primary": "oklch(0.7 0.18 350)",
      "--primary-foreground": "oklch(0.15 0.04 350)",
      "--secondary": "oklch(0.28 0.04 350)",
      "--secondary-foreground": "oklch(0.9 0.02 350)",
      "--muted": "oklch(0.25 0.04 350)",
      "--muted-foreground": "oklch(0.62 0.02 350)",
      "--accent": "oklch(0.34 0.06 350)",
      "--accent-foreground": "oklch(0.95 0.02 350)",
      "--ring": "oklch(0.7 0.18 350)",
    },
  },
};

// ============================================================
// COMPONENTS
// ============================================================
const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      clipRule="evenodd"
    />
  </svg>
);

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [copied, setCopied] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [demoTheme, setDemoTheme] = useState<ThemeName>("white");
  const spreadsheetRef = useRef<SpreadsheetRef<DemoRow>>(null);

  const copyCode = async () => {
    await navigator.clipboard.writeText(codeExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Mintlify-inspired color scheme
  const bgPrimary = darkMode ? "bg-[#0f1419]" : "bg-white";
  const bgSecondary = darkMode ? "bg-[#1a1f25]" : "bg-slate-50";
  const textPrimary = darkMode ? "text-white" : "text-slate-900";
  const textMuted = darkMode ? "text-slate-400" : "text-slate-500";
  const borderColor = darkMode ? "border-slate-800" : "border-slate-200";
  const accentColor = darkMode ? "text-emerald-400" : "text-emerald-600";
  const accentBg = darkMode ? "bg-emerald-400/10" : "bg-emerald-100";
  const accentBorder = darkMode ? "border-emerald-500/50" : "border-emerald-300";

  const currentTheme = themes[demoTheme];

  return (
    <div className={`min-h-screen ${bgPrimary} ${textPrimary} font-sans antialiased`}>
      {/* Header */}
      <header className={`border-b ${borderColor} ${bgPrimary}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${accentBg} border ${accentBorder} flex items-center justify-center`}>
              <Grid3X3 className={`w-4 h-4 ${accentColor}`} />
            </div>
            <span className="font-semibold text-lg tracking-tight">ShadSheet</span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${bgSecondary} ${textMuted}`}>
              {VERSION}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <a
              href={LINKS.docs}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${textMuted} hover:${textPrimary} hover:${bgSecondary} transition-colors`}
            >
              <BookOpen className="w-4 h-4" />
              Docs
              <ArrowUpRight className="w-3 h-3" />
            </a>
            <a
              href={LINKS.storybook}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${textMuted} hover:${textPrimary} hover:${bgSecondary} transition-colors`}
            >
              <Box className="w-4 h-4" />
              Storybook
              <ArrowUpRight className="w-3 h-3" />
            </a>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${textMuted} hover:${textPrimary} hover:${bgSecondary} transition-colors`}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <a
              href={LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-lg ${textMuted} hover:${textPrimary} hover:${bgSecondary} transition-colors`}
            >
              <GitHubIcon className="w-4 h-4" />
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className={`border-b ${borderColor}`}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6 ${accentBg} ${accentColor} border ${accentBorder}`}>
                <Box className="w-4 h-4" />
                Headless & Fully Customizable
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                Build Spreadsheets
                <br />
                <span className={accentColor}>Like a Pro</span>
              </h1>
              <p className={`text-lg mb-8 leading-relaxed ${textMuted}`}>
                A headless React spreadsheet component powered by TanStack Table,
                HyperFormula, and Zustand. Virtualized, accessible, and built for
                developers who demand control.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={LINKS.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-colors ${darkMode ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}
                >
                  <BookOpen className="w-4 h-4" />
                  Read Documentation
                </a>
                <a
                  href={LINKS.storybook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm border ${borderColor} ${textMuted} hover:${textPrimary} hover:${bgSecondary} transition-colors`}
                >
                  <Box className="w-4 h-4" />
                  View Storybook
                </a>
              </div>
            </div>
            <div className={`p-6 rounded-xl border ${borderColor} ${bgSecondary}`}>
              <div className="flex items-center gap-2 mb-4">
                <Terminal className={`w-4 h-4 ${accentColor}`} />
                <span className="font-mono text-sm">Quick Install</span>
              </div>
              <div className={`flex items-center justify-between gap-4 p-4 rounded-lg font-mono text-sm ${darkMode ? "bg-[#0f1419]" : "bg-white"} border ${borderColor}`}>
                <code className={accentColor}>
                  $ npm install @khoipn2112/shadsheet
                </code>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText("npm install @khoipn2112/shadsheet");
                  }}
                  className={`p-1.5 rounded ${textMuted} hover:${textPrimary} transition-colors`}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                {[
                  { label: "Rows", value: "100K+" },
                  { label: "Render", value: "60fps" },
                  { label: "Headless", value: "100%" },
                  { label: "Bundle", value: "153KB" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>
                      {stat.label}
                    </div>
                    <div className={`text-xl font-bold ${accentColor}`}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo with Theme Switching */}
      <section className={`border-b ${borderColor}`}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Interactive Demo</h2>
              <p className={`text-sm ${textMuted}`}>
                Read-only table with theme switching. Click cells to see selection styling.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${textMuted}`}>Theme:</span>
              {(Object.keys(themes) as ThemeName[]).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setDemoTheme(theme)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    demoTheme === theme
                      ? `${themes[theme].pageBg} ${themes[theme].labelColor} border ${themes[theme].pageBorder}`
                      : `${bgSecondary} ${textMuted} border ${borderColor} hover:${textPrimary}`
                  }`}
                >
                  {themes[theme].label}
                </button>
              ))}
            </div>
          </div>

          {/* Themed Spreadsheet Container */}
          <div
            className={`rounded-xl overflow-hidden border ${currentTheme.pageBorder} ${currentTheme.pageBg} ${currentTheme.isDark ? "dark" : ""}`}
            style={currentTheme.cssVars as React.CSSProperties}
          >
            <div className={`flex items-center gap-2 px-4 py-3 border-b ${currentTheme.pageBorder}`}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className={`ml-4 text-sm font-mono ${currentTheme.pageAccent} opacity-70`}>
                demo-readonly.xlsx
              </span>
            </div>
            <div className="h-[400px] p-3">
              <Spreadsheet
                ref={spreadsheetRef}
                data={demoData}
                columns={demoColumns}
                editable={false}
                showToolbar={false}
                showFormulaBar={false}
                theme={currentTheme.isDark ? "dark" : "light"}
                className="h-full"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <a
              href={LINKS.storybook}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 text-sm font-medium ${accentColor} hover:underline`}
            >
              <Box className="w-4 h-4" />
              Try interactive demo in Storybook
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={`border-b ${borderColor}`}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold mb-8">Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`p-6 rounded-xl border ${borderColor} ${bgSecondary} group hover:border-slate-700 transition-colors`}
              >
                <div className={`w-10 h-10 rounded-lg ${accentBg} border ${accentBorder} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-5 h-5 ${accentColor}`} />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className={`text-sm ${textMuted}`}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className={`border-b ${borderColor}`}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
              <p className={`mb-6 ${textMuted}`}>
                Define your columns with full TypeScript support. Pass your data.
                That's it.
              </p>
              <ul className={`space-y-3 text-sm ${textMuted}`}>
                {[
                  "Type-safe column definitions",
                  "Controlled or uncontrolled mode",
                  "Callbacks for every interaction",
                  "Ref API for imperative control",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Hash className={`w-3 h-3 ${accentColor}`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`rounded-xl border ${borderColor} overflow-hidden ${bgSecondary}`}>
              <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor}`}>
                <span className={`text-sm font-mono ${textMuted}`}>App.tsx</span>
                <button
                  onClick={copyCode}
                  className={`flex items-center gap-2 text-xs font-mono ${textMuted} hover:${textPrimary} transition-colors`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className={`p-4 text-sm font-mono overflow-x-auto leading-relaxed ${darkMode ? "bg-[#0f1419]" : "bg-white"}`}>
                <code>
                  {highlightCode(codeExample, darkMode)}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 ${bgSecondary}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${accentBg} border ${accentBorder} flex items-center justify-center`}>
                <Grid3X3 className={`w-4 h-4 ${accentColor}`} />
              </div>
              <div>
                <span className="font-semibold">ShadSheet</span>
                <p className={`text-xs ${textMuted}`}>Headless React Spreadsheet</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <a
                href={LINKS.docs}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${textMuted} hover:${textPrimary} hover:${bgPrimary} transition-colors`}
              >
                <BookOpen className="w-4 h-4" />
                Documentation
              </a>
              <a
                href={LINKS.storybook}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${textMuted} hover:${textPrimary} hover:${bgPrimary} transition-colors`}
              >
                <Box className="w-4 h-4" />
                Storybook
              </a>
              <a
                href={LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${textMuted} hover:${textPrimary} hover:${bgPrimary} transition-colors`}
              >
                <GitHubIcon className="w-4 h-4" />
                GitHub
              </a>
            </div>
          </div>
          <div className={`mt-8 pt-8 border-t ${borderColor} flex flex-wrap items-center gap-3 text-xs font-mono ${textMuted}`}>
            <span>React 19</span>
            <span className={borderColor}>|</span>
            <span>TanStack Table</span>
            <span className={borderColor}>|</span>
            <span>HyperFormula</span>
            <span className={borderColor}>|</span>
            <span>Zustand</span>
            <span className={borderColor}>|</span>
            <span>Tailwind CSS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}