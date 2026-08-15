"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Hero } from "@/components/sections/hero";
import { CategoryFilter } from "@/components/sections/category-filter";
import { MerchantCard } from "@/components/sections/merchant-card";
import { MerchantCardSkeleton } from "@/components/sections/merchant-card-skeleton";
import { Footer } from "@/components/sections/footer";
import { supabase } from "@/lib/supabase";
import { FadeIn } from "@/app/components/animations";
import type { Merchant } from "@/types";

export default function HomePage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Fetch merchants on mount
  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setMerchants(data as Merchant[]);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // Filter logic
  const filtered = useMemo(() => {
    return merchants.filter((m) => {
      const matchesCategory =
        activeCategory === "All" ||
        (m.cuisine_type || "").toLowerCase().includes(activeCategory.toLowerCase());
      const q = searchQuery.toLowerCase().trim();
      const searchMatch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.cuisine_type || "").toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q);
      return matchesCategory && searchMatch;
    });
  }, [activeCategory, searchQuery, merchants]);

  // Handle search with loading state
  const handleSearch = useCallback((query: string) => {
    setIsSearching(true);
    setSearchQuery(query);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  // Handle category change with loading state
  const handleCategoryChange = useCallback((category: string) => {
    setIsSearching(true);
    setActiveCategory(category);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  const showLoading = loading || isSearching;

  return (
    <main>
      <Hero onSearch={handleSearch} />
      <CategoryFilter active={activeCategory} onChange={handleCategoryChange} />

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          {/* Results count */}
          {!showLoading && filtered.length > 0 && (
            <FadeIn>
              <p className="mb-6 text-sm text-[#8A968B]">
                {filtered.length} {filtered.length === 1 ? "restaurant" : "restaurants"} found
                {searchQuery && ` for "${searchQuery}"`}
                {activeCategory !== "All" && ` in ${activeCategory}`}
              </p>
            </FadeIn>
          )}

          {showLoading ? (
            // Skeleton loading grid
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <MerchantCardSkeleton key={i} delay={i * 0.08} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <FadeIn>
              <div className="py-20 text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#F0F4EC]">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8A968B"
                    strokeWidth="1.5"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-[#2C3E2D]">
                  No restaurants found
                </p>
                <p className="mt-2 text-sm text-[#8A968B]">
                  Try adjusting your search or category filter.
                </p>
                {(searchQuery || activeCategory !== "All") && (
                  <button
                    onClick={() => {
                      handleSearch("");
                      handleCategoryChange("All");
                    }}
                    className="mt-4 rounded-full bg-[#5A8F6E] px-6 py-2 text-sm font-medium text-white active:scale-[0.98] transition-transform duration-150"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </FadeIn>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((merchant, index) => (
                <FadeIn
                  key={`${merchant.id}-${activeCategory}-${searchQuery}`}
                  delay={index * 0.06}
                  duration={0.4}
                  direction="up"
                >
                  <MerchantCard merchant={merchant} />
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
