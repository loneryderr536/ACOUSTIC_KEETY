"use client";

import { Reticle } from "./Reticle";

export function SearchBar({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search operatives..."
        className="w-full pr-10 pl-4 py-2.5 bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:border-emerald-500/30 focus:outline-none backdrop-blur-sm tracking-wider transition-colors"
      />
      <Reticle
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600"
      />
    </div>
  );
}
