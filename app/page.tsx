/* bitesite/app/page.tsx */

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Hero } from "@/components/sections/hero";
import { CategoryFilter } from "@/components/sections/category-filter";
import { MerchantCard } from "@/components/sections/merchant-card";
import { MerchantCardSkeleton } from "@/components/sections/merchant-card-skeleton";
import { Footer } from "@/components/sections/footer";
import { LatestStories } from "@/components/sections/latest-stories";
import { supabase, getAreas } from "@/lib/supabase";
import { FadeIn } from "@/app/components/animations";
import { isCurrentlyOpen, getTodayKey } from "@/lib/hours";
import { trackEvent } from "@/lib/analytics";
import { CUISINE_TYPES } from "@/lib/presets";
import type { PublicMerchant } from "@/types";
import { PUBLIC_MERCHANT_SELECT } from "@/lib/public-merchant-projection.mjs";
import { discoveryGroups, discoveryPath } from "@/lib/discovery-core.mjs";
import { selectNearby } from "@/lib/nearby-core.mjs";

const STATE_KEY = "bitesite.home.state";

// The chosen state is remembered in this browser; storage can be blocked, so every access is guarded.
function readSavedState(): string | null {
  try { return window.localStorage.getItem(STATE_KEY); } catch { return null; }
}
function saveState(state: string | null) {
  try {
    if (state) window.localStorage.setItem(STATE_KEY, state); else window.localStorage.removeItem(STATE_KEY);
  } catch { /* storage unavailable */ }
}

function readHomeFilters() {
  if (typeof window === "undefined") {
    return { cuisines: [] as string[], state: null as string | null, area: null as string | null, more: [] as string[], openNow: false, search: "" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    cuisines: params.get("cuisine")?.split(",").map(value => value.trim()).filter(Boolean) || [],
    state: params.get("state") || readSavedState(),
    area: params.get("area") || null,
    more: params.get("more")?.split(",").map(value => value.trim()).filter(Boolean) || [],
    openNow: params.get("open") === "1",
    search: params.get("q") || "",
  };
}

export default function HomePage() {
  const [merchants, setMerchants] = useState<PublicMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCuisines, setActiveCuisines] = useState<string[]>(() => readHomeFilters().cuisines);
  const [activeState, setActiveState] = useState<string | null>(() => readHomeFilters().state);
  const [areaStates, setAreaStates] = useState<Map<string, string>>(new Map());
  const [activeArea, setActiveArea] = useState<string | null>(() => readHomeFilters().area);
  const [activeMore, setActiveMore] = useState<string[]>(() => readHomeFilters().more);
  const [searchQuery, setSearchQuery] = useState(() => readHomeFilters().search);
  const [openNow, setOpenNow] = useState(() => readHomeFilters().openNow);
  const [isSearching, setIsSearching] = useState(false);
  const [productIndex, setProductIndex] = useState<Map<string, string[]>>(new Map());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [nearbyActive, setNearbyActive] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const locationRequestRef = useRef(0);

  // Keep discovery state shareable and restore it when users navigate back.
  useEffect(() => {
    const onPopState = () => {
      locationRequestRef.current += 1;
      setNearbyActive(false);
      setNearbyLoading(false);
      setCoordinates(null);
      const filters = readHomeFilters();
      setActiveCuisines(filters.cuisines);
      setActiveState(filters.state);
      setActiveArea(filters.area);
      setActiveMore(filters.more);
      setSearchQuery(filters.search);
      setOpenNow(filters.openNow);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (activeCuisines.length > 0) params.set("cuisine", activeCuisines.join(","));
    if (activeState) params.set("state", activeState);
    if (activeArea && activeArea !== "All Areas") params.set("area", activeArea);
    if (activeMore.length > 0) params.set("more", activeMore.join(","));
    if (openNow) params.set("open", "1");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [activeCuisines, activeState, activeArea, activeMore, searchQuery, openNow]);

  // Fetch merchants + products on mount. View counts are private (DEC-29) and not read here.
  // Only the public merchant columns are readable; row level security decides which merchants.
  useEffect(() => {
    async function fetchData() {
      const [{ data: merchantsData, error: merchantsError }, { data: productsData }] = await Promise.all([
        supabase
          .from("merchants")
          .select(PUBLIC_MERCHANT_SELECT)
          .order("created_at", { ascending: false })
          .returns<PublicMerchant[]>(),
        supabase
          .from("products")
          .select("merchant_id, name")
          .eq("is_available", true),
      ]);

      if (!merchantsError && merchantsData) {
        setMerchants(merchantsData);
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
    // The state picker needs each area's state; without the list it simply stays hidden.
    getAreas().then((list) => setAreaStates(new Map(list.map((a) => [a.name, a.state]))), () => {});

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

  // States that have at least one restaurant; the picker only appears when there are two or more.
  const availableStates = useMemo(() => {
    const states = new Set<string>();
    merchants.forEach((m) => {
      const state = m.area ? areaStates.get(m.area) : undefined;
      if (state) states.add(state);
    });
    return Array.from(states).sort();
  }, [merchants, areaStates]);
  const currentState = activeState && availableStates.length > 1 && availableStates.includes(activeState) ? activeState : null;

  // 动态提取所有 area (within the chosen state)
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    merchants.forEach((m) => {
      if (m.area && (!currentState || areaStates.get(m.area) === currentState)) areas.add(m.area);
    });
    return ["All Areas", ...Array.from(areas).sort()];
  }, [merchants, areaStates, currentState]);

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

  const browseGroups = useMemo(() => (["area", "cuisine"] as const).map((kind) => ({
    kind,
    title: kind === "area" ? "Browse by area" : "Browse by cuisine",
    groups: discoveryGroups(kind, merchants).filter((group) => group.indexable).slice(0, 12),
  })), [merchants]);

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

      const matchesState = !currentState || (m.area ? areaStates.get(m.area) === currentState : false);
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

      return matchesCuisine && matchesState && matchesArea && matchesMore && matchesOpenNow && searchMatch;
    });
  }, [activeCuisines, currentState, areaStates, activeArea, activeMore, openNow, searchQuery, merchants, productIndex]);

  const nearbySelection = useMemo(() => nearbyActive && coordinates
    ? selectNearby(filtered, coordinates.latitude, coordinates.longitude)
    : null, [nearbyActive, coordinates, filtered]);
  const visibleMerchants = nearbySelection?.results.map((item) => item.merchant) ?? filtered;
  const distanceById = new Map(nearbySelection?.results.map((item) => [item.merchant.id, item.distanceKm]) ?? []);

  const handleNearbyChange = useCallback((active: boolean) => {
    locationRequestRef.current += 1;
    const requestId = locationRequestRef.current;
    if (!active) {
      setNearbyActive(false);
      setNearbyLoading(false);
      setCoordinates(null);
      setLocationError("");
      return;
    }
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Location is unavailable. Showing restaurants by your selected state or area instead.");
      return;
    }
    setNearbyLoading(true);
    navigator.geolocation.getCurrentPosition((position) => {
      if (locationRequestRef.current !== requestId) return;
      setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setNearbyActive(true);
      setNearbyLoading(false);
      setActiveState(null);
      setActiveArea(null);
      saveState(null);
    }, () => {
      if (locationRequestRef.current !== requestId) return;
      setCoordinates(null);
      setNearbyActive(false);
      setNearbyLoading(false);
      setLocationError("Location permission was denied or unavailable. Showing restaurants by your selected state or area instead.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }, []);

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

  const handleStateChange = useCallback((state: string | null) => {
    if (nearbyActive) handleNearbyChange(false);
    setIsSearching(true);
    setActiveState(state);
    saveState(state);
    // An area from another state would hide every restaurant, so it is cleared.
    setActiveArea((area) => (area && state && areaStates.get(area) !== state ? null : area));
    setTimeout(() => setIsSearching(false), 300);
  }, [areaStates, nearbyActive, handleNearbyChange]);

  const handleAreaChange = useCallback((area: string | null) => {
    if (nearbyActive) handleNearbyChange(false);
    setIsSearching(true);
    setActiveArea(area);
    setTimeout(() => setIsSearching(false), 300);
  }, [nearbyActive, handleNearbyChange]);

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
    handleNearbyChange(false);
    setIsSearching(true);
    setSearchQuery("");
    setActiveCuisines([]);
    setActiveState(null);
    saveState(null);
    setActiveArea(null);
    setActiveMore([]);
    setOpenNow(false);
    setTimeout(() => setIsSearching(false), 300);
  }, [handleNearbyChange]);

  const showLoading = loading || isSearching;

  const activeFilterCount =
    activeCuisines.length +
    (currentState ? 1 : 0) +
    (activeArea && activeArea !== "All Areas" ? 1 : 0) +
    activeMore.length +
    (openNow ? 1 : 0) +
    (nearbyActive ? 1 : 0) +
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

      {availableStates.length > 1 && (
        <div className="px-4 pt-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2" role="group" aria-label="Choose a state">
            <span className="mr-1 text-sm font-medium text-[#2C3E2D]">State</span>
            {[null, ...availableStates].map((state) => (
              <button key={state ?? "all"} type="button" aria-pressed={currentState === state} onClick={() => handleStateChange(state)}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors ${currentState === state ? "border-[#2C3E2D] bg-[#2C3E2D] text-white" : "border-[#C9D6C7] bg-white text-[#2C3E2D] hover:bg-[#F0F4EC]"}`}>
                {state ?? "All states"}
              </button>
            ))}
          </div>
        </div>
      )}

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
        nearbyActive={nearbyActive}
        nearbyLoading={nearbyLoading}
        onNearbyChange={handleNearbyChange}
      />

      {locationError && <p role="status" className="mx-auto max-w-6xl px-4 pt-4 text-sm text-[#6B6560]">{locationError}</p>}
      {nearbySelection && <p role="status" className="mx-auto max-w-6xl px-4 pt-4 text-sm text-[#6B6560]">Showing restaurants within {nearbySelection.radiusKm} km of your location.</p>}

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          {!showLoading && visibleMerchants.length > 0 && (
            <FadeIn>
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <p className="text-sm text-[#8A968B]">
                  {visibleMerchants.length} {visibleMerchants.length === 1 ? "restaurant" : "restaurants"} found
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
          ) : visibleMerchants.length === 0 ? (
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
                  {nearbySelection ? "No restaurants found nearby. Try another area or turn off Nearby." : "Try adjusting your filters or search."}
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
              {visibleMerchants.map((merchant, index) => (
                <FadeIn
                  key={`${merchant.id}-${activeCuisines.join(",")}-${currentState}-${activeArea}-${activeMore.join(",")}-${openNow}-${searchQuery}`}
                  delay={index * 0.06}
                  duration={0.4}
                  direction="up"
                >
                  <MerchantCard merchant={merchant} distanceKm={distanceById.get(merchant.id)} />
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>

      {browseGroups.some(({ groups }) => groups.length > 0) && (
        <section className="px-4 pb-16" aria-label="Browse restaurants">
          <div className="mx-auto max-w-6xl space-y-8">
            {browseGroups.map(({ kind, title, groups }) => groups.length > 0 && (
              <div key={kind}>
                <h2 className="mb-3 text-xl font-semibold text-[#2C3E2D]">{title}</h2>
                <div className="flex flex-wrap gap-2">
                  {groups.map((group) => (
                    <a key={group.slug} href={discoveryPath(kind, group.slug)}
                      className="inline-flex min-h-11 items-center rounded-full border border-[#C9D6C7] bg-white px-4 text-sm font-medium text-[#2C3E2D] transition-colors hover:bg-[#F0F4EC]">
                      {group.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <LatestStories />
      <Footer />
    </main>
  );
}
