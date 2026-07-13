import { code128 } from "@/lib/barcode";

export interface BarcodeProps {
  value: string;
  height?: number; // px
  moduleWidth?: number; // px per module
  showValue?: boolean;
  className?: string;
}

// Renders a Code 128 barcode as crisp SVG (prints cleanly at any scale).
export default function Barcode({
  value,
  height = 56,
  moduleWidth = 1.6,
  showValue = true,
  className,
}: BarcodeProps) {
  const { modules, bars } = code128(value);
  const width = modules * moduleWidth;

  return (
    <div className={className}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Barcode ${value}`}
        className="max-w-full"
      >
        <rect width={width} height={height} fill="#fff" />
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x * moduleWidth}
            y={0}
            width={b.w * moduleWidth}
            height={height}
            fill="#000"
          />
        ))}
      </svg>
      {showValue && (
        <p className="text-center font-mono text-xs tracking-[0.2em] text-black">
          {value}
        </p>
      )}
    </div>
  );
}
