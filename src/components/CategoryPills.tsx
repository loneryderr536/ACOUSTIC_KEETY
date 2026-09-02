"use client";

export function CategoryPills({
  categories,
  selected,
  onSelect,
}: {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {categories.map((cat) => {
        const isActive = cat === selected;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`px-3 py-1.5 text-[9px] tracking-[0.15em] uppercase font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
              isActive
                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.05]"
                : "border-white/[0.06] text-zinc-600 bg-white/[0.02] hover:text-zinc-300 hover:border-white/[0.1]"
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
