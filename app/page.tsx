/* bitesite/app/page.tsx  */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Hero } from "@/components/sections/hero";
import { CategoryFilter } from "@/components/sections/category-filter";
import { MerchantCard } from "@/components/sections/merchant-card";
import { MerchantCardSkeleton } from "@/components/sections/merchant-card-skeleton";
import { Footer } from "@/components/sections/footer";
import { supabase } from "@/lib/supabase";
import { FadeIn } from "@/app/components/animations";
import { isCurrentlyOpen } from "@/lib/hours";
import type { Merchant } from "@/types";

export default function HomePage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [openNow, setOpenNow] = useState(false);
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
      // Tag filter: OR logic (any selected tag matches)
      const matchesTags =
        activeTags.length === 0 ||
        activeTags.some((tag) =>
          m.tags?.some((t) => t.toLowerCase() === tag.toLowerCase())
        );

      // Open Now filter
      const matchesOpenNow = !openNow || (() => {
        const todayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
          new Date().getDay()
        ];
        const hours = m.operating_hours?.[todayKey];
        return hours ? isCurrentlyOpen(hours) : false;
      })();

      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const searchMatch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.cuisine_type || "").toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q) ||
        m.tags?.some((t) => t.toLowerCase().includes(q));

      return matchesTags && matchesOpenNow && searchMatch;
    });
  }, [activeTags, openNow, searchQuery, merchants]);

  // Handle search with loading state
  const handleSearch = useCallback((query: string) => {
    setIsSearching(true);
    setSearchQuery(query);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  // Handle tag change with loading state
  const handleTagChange = useCallback((tags: string[]) => {
    setIsSearching(true);
    setActiveTags(tags);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  // Handle Open Now toggle
  const handleOpenNowChange = useCallback((v: boolean) => {
    setIsSearching(true);
    setOpenNow(v);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  // Clear everything
  const handleClearAll = useCallback(() => {
    setIsSearching(true);
    setSearchQuery("");
    setActiveTags([]);
    setOpenNow(false);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  const showLoading = loading || isSearching;

  // Active filter count
  const activeFilterCount = activeTags.length + (openNow ? 1 : 0) + (searchQuery ? 1 : 0);

  return (
    <main>
      <Hero searchQuery={searchQuery} onSearch={handleSearch} />

      <CategoryFilter
        activeTags={activeTags}
        onChange={handleTagChange}
        openNow={openNow}
        onOpenNowChange={handleOpenNowChange}
      />

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          {/* Results count + active filters */}
          {!showLoading && filtered.length > 0 && (
            <FadeIn>
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <p className="text-sm text-[#8A968B]">
                  {filtered.length} {filtered.length === 1 ? "restaurant" : "restaurants"} found
                </p>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-[#5A8F6E]/10 px-2 py-0.5 text-xs text-[#5A8F6E]">
                    {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                  </span>
                )}
              </div>
            </FadeIn>
          )}

          {showLoading ? (
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
                  Try adjusting your filters or search.
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="mt-4 rounded-full bg-[#5A8F6E] px-6 py-2 text-sm font-medium text-white active:scale-[0.98] transition-transform duration-150"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </FadeIn>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((merchant, index) => (
                <FadeIn
                  key={`${merchant.id}-${activeTags.join(",")}-${openNow}-${searchQuery}`}
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
