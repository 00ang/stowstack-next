"use client";

/**
 * The one line a focused tool uses when it is only showing what names the
 * object. "Show all" reveals the rest; "Just the …" puts it back.
 */
export function FocusScopeToggle({
  name,
  named,
  total,
  showAll,
  onToggle,
}: {
  name: string;
  named: number;
  total: number;
  showAll: boolean;
  onToggle: () => void;
}) {
  if (!name || named === total) return null;
  const line = named === 0 ? `Nothing here names the ${name}.` : named === 1 ? `1 names the ${name}.` : `${named} name the ${name}.`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-2 text-[13px] font-semibold text-[var(--ic-ink)]">
      <span>{line}</span>
      <button type="button" onClick={onToggle} className="font-extrabold underline underline-offset-4">
        {showAll ? `Just the ${name}` : `Show all (${total})`}
      </button>
    </div>
  );
}
