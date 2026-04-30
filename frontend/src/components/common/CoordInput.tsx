const COORD_STEP = 0.005;

export function CoordInput({
  axis,
  value,
  onChange,
  disabled,
}: {
  axis: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const bump = (delta: number) =>
    onChange(Math.round((value + delta) * 1000) / 1000);

  return (
    <div className="flex items-center gap-2">
      <span className="w-4 font-mono text-xs text-zinc-400">{axis}</span>
      <button
        onClick={() => bump(-COORD_STEP)}
        disabled={disabled}
        className="w-7 h-7 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-sm font-bold transition-colors"
      >
        −
      </button>
      <span className="w-16 text-center font-mono text-sm text-zinc-100">
        {value.toFixed(3)}
      </span>
      <button
        onClick={() => bump(+COORD_STEP)}
        disabled={disabled}
        className="w-7 h-7 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-sm font-bold transition-colors"
      >
        +
      </button>
      <span className="text-xs text-zinc-500">m</span>
    </div>
  );
}
