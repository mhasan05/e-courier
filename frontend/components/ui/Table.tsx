import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Render the cell. Falls back to (row as any)[key] when omitted. */
  render?: (row: T) => ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  emptyMessage?: string;
  className?: string;
  /** Extra classes per row (e.g. to highlight selected rows). */
  rowClassName?: (row: T) => string | false | undefined;
  /** Makes rows clickable (cursor + onClick). */
  onRowClick?: (row: T) => void;
}

// Generic, typed data table with the shared design-system styling.
export default function Table<T>({
  columns,
  data,
  rowKey,
  emptyMessage = "No records found.",
  className,
  rowClassName,
  onRowClick,
}: TableProps<T>) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-brown-100 bg-white shadow-card",
        className,
      )}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-brown-100 bg-brown-50/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "whitespace-nowrap px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-brown-400",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-sm text-brown-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-brown-100/70 transition-colors last:border-0 hover:bg-brown-50/70",
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row),
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-5 py-3.5 align-middle text-brown-700", col.className)}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
