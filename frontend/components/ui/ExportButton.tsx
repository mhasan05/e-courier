"use client";

import { Download } from "lucide-react";
import Button from "./Button";

export interface ExportButtonProps<T> {
  data: T[];
  filename?: string;
  /** Column order + header labels. Defaults to keys of the first row. */
  columns?: { key: keyof T; header: string }[];
  label?: string;
  disabled?: boolean;
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote when the value contains a comma, quote, or newline.
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Generates a CSV from an array of objects and triggers a browser download.
export default function ExportButton<T extends Record<string, unknown>>({
  data,
  filename = "export.csv",
  columns,
  label = "Export CSV",
  disabled,
}: ExportButtonProps<T>) {
  const handleExport = () => {
    if (data.length === 0) return;
    const cols =
      columns ??
      (Object.keys(data[0]) as (keyof T)[]).map((key) => ({
        key,
        header: String(key),
      }));

    const header = cols.map((c) => toCsvValue(c.header)).join(",");
    const rows = data.map((row) =>
      cols.map((c) => toCsvValue(row[c.key])).join(","),
    );
    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="md"
      onClick={handleExport}
      disabled={disabled || data.length === 0}
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
