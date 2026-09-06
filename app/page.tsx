/* bitesite/app/page.tsx */

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Hero } from "@/components/sections/hero";
import { CategoryFilter } from "@/components/sections/category-filter";
import { MerchantCard } from "@/components/sections/merchant-card";
import { MerchantCardSkeleton } from "@/components/sections/merchant-card-skeleton";
import { Footer } from "@/components/sections/footer";
import { LatestStories } from "@/components/sections/latest-stories";
import { supabase } from "@/lib/supabase";
import { FadeIn } from "@/app/components/animations";
import { isCurrentlyOpen, getTodayKey } from "@/lib/hours";
import { trackEvent } from "@/lib/analytics";
import { CUISINE_TYPES } from "@/lib/presets";
import type { Merchant } from "@/types";

export default function HomePage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantStats, setMerchantStats] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeCuisines, setActiveCuisines] = useState<string[]>([]);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [activeMore, setActiveMore] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [openNow, setOpenNow] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [productIndex, setProductIndex] = useState<Map<string, string[]>>(new Map());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch merchants + stats + products on mount
  useEffect(() => {
    async function fetchData() {
      const [{ data: merchantsData, error: merchantsError }, { data: statsData }, { data: productsData }] = await Promise.all([
        supabase
          .from("merchants")
          .select("*")
          .eq("is_published", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("merchant_stats")
          .select("slug, view_count"),
        supabase
          .from("products")
          .select("merchant_id, name")
          .eq("is_available", true),
      ]);

      if (!merchantsError && merchantsData) {
        setMerchants(merchantsData as Merchant[]);
      }

      if (statsData) {
        const map = new Map<string, number>();
        statsData.forEach((s: { slug: string; view_count: number }) => {
          map.set(s.slug, s.view_count || 0);
        });
        setMerchantStats(map);
      }

      if (productsData) {
        const map = new Map<string, string[]>();
        productsData.forEach((p: { merchant_id: string; name: string }) => {
          const list = map.get(p.merchant_id) || [];
          list.push(p.name.toLowerCase());
          map.set(p.merchant_id, list);
        });
        setProductIndex(map);
      }

      setLoading(false);
    }
    fetchData();

    // Track homepage view
    trackEvent('page_view', { pageType: 'home' });
  }, []);

  // Track search events with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        trackEvent('search', { pageType: 'home', detail: searchQuery.trim() });
      }, 1000);
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // 动态提取所有 area
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    merchants.forEach((m) => {
      if (m.area) areas.add(m.area);
    });
    return ["All Areas", ...Array.from(areas).sort()];
  }, [merchants]);

  // 动态提取所有 cuisine_type（预设内按预设顺序，预设外归类为 "Other"）
  const availableCuisines = useMemo(() => {
    const presetCuisines = new Set<string>();
    const hasOther = merchants.some((m) => {
      if (!m.cuisine_type) return false;
      const isPreset = (CUISINE_TYPES as readonly string[]).includes(m.cuisine_type);
      if (isPreset) {
        presetCuisines.add(m.cuisine_type);
      }
      return !isPreset;
    });

    const result = (CUISINE_TYPES as readonly string[]).filter((c) => presetCuisines.has(c));
    if (hasOther) {
      result.push("Other");
    }
    return result;
  }, [merchants]);

  // 动态提取所有 tags + payment_methods 作为 More 筛选
  const availableMore = useMemo(() => {
    const allMore = new Set<string>();
    merchants.forEach((m) => {
      m.tags?.forEach((t) => allMore.add(t));
      m.payment_methods?.forEach((p) => allMore.add(p));
    });
    return Array.from(allMore).sort();
  }, [merchants]);

  // Filter logic
  const filtered = useMemo(() => {
    return merchants.filter((m) => {
      const matchesCuisine =
        activeCuisines.length === 0 ||
        activeCuisines.some((c) => {
          if (c === "Other") {
            return m.cuisine_type && !(CUISINE_TYPES as readonly string[]).includes(m.cuisine_type);
          }
          return (
            m.cuisine_type?.toLowerCase() === c.toLowerCase() ||
            m.tags?.some((t) => t.toLowerCase() === c.toLowerCase())
          );
        });

      const matchesArea = !activeArea || activeArea === "All Areas" || m.area === activeArea;

      const matchesMore =
        activeMore.length === 0 ||
        activeMore.some((item) => {
          return (
            m.tags?.some((t) => t.toLowerCase() === item.toLowerCase()) ||
            m.payment_methods?.some((p) => p.toLowerCase() === item.toLowerCase())
          );
        });

      const matchesOpenNow = !openNow || (() => {
        const todayKey = getTodayKey();
        const hours = m.operating_hours?.[todayKey];
        return hours ? isCurrentlyOpen(hours) : false;
      })();

      const q = searchQuery.toLowerCase().trim();
      const searchMatch = (() => {
        if (!q) return true;
        if (m.name.toLowerCase().includes(q)) return true;
        if ((m.cuisine_type || "").toLowerCase().includes(q)) return true;
        if ((m.description || "").toLowerCase().includes(q)) return true;
        if (m.tags?.some((t) => t.toLowerCase().includes(q))) return true;
        const merchantProducts = productIndex.get(m.id) || [];
        return merchantProducts.some((name) => name.includes(q));
      })();

      return matchesCuisine && matchesArea && matchesMore && matchesOpenNow && searchMatch;
    });
  }, [activeCuisines, activeArea, activeMore, openNow, searchQuery, merchants, productIndex]);

  // Handle search with loading state
  const handleSearch = useCallback((query: string) => {
    setIsSearching(true);
    setSearchQuery(query);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  const handleCuisineChange = useCallback((tags: string[]) => {
    setIsSearching(true);
    setActiveCuisines(tags);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  const handleAreaChange = useCallback((area: string | null) => {
    setIsSearching(true);
    setActiveArea(area);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  const handleMoreChange = useCallback((more: string[]) => {
    setIsSearching(true);
    setActiveMore(more);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  const handleOpenNowChange = useCallback((v: boolean) => {
    setIsSearching(true);
    setOpenNow(v);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  const handleClearAll = useCallback(() => {
    setIsSearching(true);
    setSearchQuery("");
    setActiveCuisines([]);
    setActiveArea(null);
    setActiveMore([]);
    setOpenNow(false);
    setTimeout(() => setIsSearching(false), 300);
  }, []);

  const showLoading = loading || isSearching;

  const activeFilterCount =
    activeCuisines.length +
    (activeArea && activeArea !== "All Areas" ? 1 : 0) +
    activeMore.length +
    (openNow ? 1 : 0) +
    (searchQuery ? 1 : 0);

  return (
    <main>
      {/* Restaurant owner banner */}
      <div className="bg-[#2C3E2D] px-4 py-3 text-center">
        <p className="text-sm text-white">
          Are you a restaurant owner?{" "}
          <a
             href="/join-us"
             className="font-semibold underline underline-offset-2 transition-colors hover:text-[#5A8F6E]"
          >
            Join BiteSite
          </a>
        </p>
      </div>
      <Hero searchQuery={searchQuery} onSearch={handleSearch} />

      <CategoryFilter
        activeCuisines={activeCuisines}
        onCuisineChange={handleCuisineChange}
        activeArea={activeArea}
        onAreaChange={handleAreaChange}
        activeMore={activeMore}
        onMoreChange={handleMoreChange}
        openNow={openNow}
        onOpenNowChange={handleOpenNowChange}
        availableAreas={availableAreas}
        availableCuisines={availableCuisines}
        availableMore={availableMore}
      />

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
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
                  key={`${merchant.id}-${activeCuisines.join(",")}-${activeArea}-${activeMore.join(",")}-${openNow}-${searchQuery}`}
                  delay={index * 0.06}
                  duration={0.4}
                  direction="up"
                >
                  <MerchantCard 
                    merchant={merchant} 
                    viewCount={merchantStats.get(merchant.slug) || 0}
                  />
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>

      <LatestStories />
      <Footer />
    </main>
  );
}
