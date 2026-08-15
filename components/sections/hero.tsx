"use client";

import { Search, X } from "lucide-react";
import { useState, useCallback } from "react";
import { FadeIn } from "@/app/components/animations";

interface HeroProps {
  onSearch?: (query: string) => void;
}

export function Hero({ onSearch }: HeroProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      onSearch?.(value);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    onSearch?.("");
  }, [onSearch]);

  return (
    <FadeIn direction="up" duration={0.6}>
      <section
        className="relative flex min-h-[55vh] flex-col items-center justify-center px-4 py-16 text-center"
        style={{ backgroundColor: "#F0F4EC" }}
      >
        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232C3E2D' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10">
          <h1 className="mb-4 max-w-2xl font-serif text-3xl font-medium leading-tight tracking-tight text-[#2C3E2D] sm:text-4xl md:text-5xl lg:text-6xl">
            Beautiful Menus for Local Restaurants
          </h1>
          <p className="mb-8 max-w-lg text-base leading-relaxed text-[#6B6560] md:text-lg">
            Discover cafes and restaurants in Kuala Lumpur. Browse photos,
            explore menus, and find your next favorite spot.
          </p>

          {/* Search Bar */}
          <div
            className={`relative mx-auto w-full max-w-md rounded-full bg-[#FAFBF7] shadow-sm transition-all duration-300 ${
              isFocused
                ? "shadow-md ring-1 ring-[#5A8F6E]"
                : "shadow-sm"
            }`}
          >
            <div className="flex items-center">
              <Search className="ml-4 h-4 w-4 flex-shrink-0 text-[#8A968B]" />
              <input
                type="text"
                placeholder="Search restaurants, cuisines..."
                value={query}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-full bg-transparent py-3.5 pl-3 pr-10 text-sm text-[#2C3E2D] outline-none placeholder:text-[#8A968B]"
              />
              {query && (
                <button
                  onClick={handleClear}
                  className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#DDE5DC] text-[#6B6560] active:scale-90 transition-transform duration-150"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}
