"use client";

import { Search } from "lucide-react";
import { useState } from "react";

interface HeroProps {
  onSearch?: (query: string) => void;
}

export function Hero({ onSearch }: HeroProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
  };

  return (
    <section className="relative flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center" style={{ backgroundColor: "#F0F4EC" }}>
      <h1 className="mb-4 max-w-2xl font-serif text-4xl font-medium leading-tight text-[#2C3E2D] md:text-5xl lg:text-6xl">
        Beautiful Menus for Local Restaurants
      </h1>
      <p className="mb-8 max-w-lg text-base text-[#6B6560] md:text-lg">
        Discover cafes and restaurants in Kuala Lumpur. Browse photos, explore menus, and find your next favorite spot.
      </p>
      <form onSubmit={handleSubmit} className="relative w-full max-w-md">
        <input
          type="text"
          placeholder="Search restaurants, cuisines..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-full border border-[#DDE5DC] bg-[#FAFBF7] py-3 pl-5 pr-12 text-sm text-[#2C3E2D] shadow-sm outline-none transition-all placeholder:text-[#8A968B] focus:border-[#5A8F6E] focus:ring-1 focus:ring-[#5A8F6E]"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-[#5A8F6E] p-2 text-white transition-colors hover:bg-[#4A7A5E]"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
