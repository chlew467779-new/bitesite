/* bitesite/app/page.tsx */

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { HomeFilters } from "@/components/home/home-filters";
import { MerchantCard } from "@/components/sections/merchant-card";
import { SearchInput } from "@/components/ui/search-input";
import { SectionTitle } from "@/components/ui/card";
import { Chip, chipClasses } from "@/components/ui/chip";
import { buttonClasses } from "@/components/ui/button";
import { priceRange } from "@/lib/store-summary.mjs";
import { useFavourites } from "@/lib/favourites";
import { useT, type MessageKey } from "@/lib/i18n";
import { MerchantCardSkeleton } from "@/components/sections/merchant-card-skeleton";
import { Footer } from "@/components/sections/footer";
import { LatestStories } from "@/components/sections/latest-stories";
import { SiteAnnouncement } from "@/components/sections/site-announcement";
import { supabase, getAreas } from "@/lib/supabase";
import { isCurrentlyOpen, getTodayKey } from "@/lib/hours";
import { trackEvent } from "@/lib/analytics";
import { CUISINE_TYPES, RETIRED_AMENITY_TAGS } from "@/lib/presets";
import type { PublicMerchant } from "@/types";
import { PUBLIC_MERCHANT_SELECT } from "@/lib/public-merchant-projection.mjs";
import { discoveryGroups, discoveryPath } from "@/lib/discovery-core.mjs";
import { DEFAULT_NEARBY_RADIUS_KM, NEARBY_RADII_KM, selectNearby } from "@/lib/nearby-core.mjs";

const STATE_KEY = "bitesite.home.state";

type MenuPrice = { price: number | null; discount_price: number | null; show_prices: boolean | null };

// Pastel tiles for "Craving something?" (photos come later; colours keep the row lively).
const CRAVING_TILES = ["bg-[#F1E0C8]", "bg-[#F3D6CC]", "bg-[#DCE6D6]", "bg-[#E9E2F0]", "bg-[#D6E3EE]", "bg-[#F0E6C4]"];

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
    return { cuisines: [] as string[], state: null as string | null, area: null as string | null, more: [] as string[], openNow: false, search: "", labels: [] as string[] };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    cuisines: params.get("cuisine")?.split(",").map(value => value.trim()).filter(Boolean) || [],
    state: params.get("state") || readSavedState(),
    area: params.get("area") || null,
    more: params.get("more")?.split(",").map(value => value.trim()).filter(Boolean) || [],
    openNow: params.get("open") === "1",
    labels: params.get("label")?.split(",").filter((value) => value === "halal" || value === "veg") || [],
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
  // R5 food labels: "halal" (BiteSite-verified certificate) and "veg" (restaurant-declared).
  const [labels, setLabels] = useState<string[]>(() => readHomeFilters().labels);
  const [isSearching, setIsSearching] = useState(false);
  const [productIndex, setProductIndex] = useState<Map<string, string[]>>(new Map());
  const t = useT();
  const { slugs: savedSlugs } = useFavourites();
  const [savedOnly, setSavedOnly] = useState(false);
  const [menuPrices, setMenuPrices] = useState<Map<string, MenuPrice[]>>(new Map());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // How many restaurants the current search shows (null while loading), sent with the search event.
  const searchResultsRef = useRef<number | null>(null);
  const [nearbyActive, setNearbyActive] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(DEFAULT_NEARBY_RADIUS_KM);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<MessageKey | "">("");
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
      setLabels(filters.labels);
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
    if (labels.length > 0) params.set("label", labels.join(","));
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [activeCuisines, activeState, activeArea, activeMore, searchQuery, openNow, labels]);

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
          .select("merchant_id, name, price, discount_price, show_prices")
          .eq("is_available", true),
      ]);

      if (!merchantsError && merchantsData) {
        setMerchants(merchantsData);
      }

      if (productsData) {
        const map = new Map<string, string[]>();
        const prices = new Map<string, MenuPrice[]>();
        productsData.forEach((p: { merchant_id: string; name: string } & MenuPrice) => {
          const list = map.get(p.merchant_id) || [];
          list.push(p.name.toLowerCase());
          map.set(p.merchant_id, list);
          const priced = prices.get(p.merchant_id) || [];
          priced.push({ price: p.price, discount_price: p.discount_price, show_prices: p.show_prices });
          prices.set(p.merchant_id, priced);
        });
        setProductIndex(map);
        setMenuPrices(prices);
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
        trackEvent('search', { pageType: 'home', detail: searchQuery.trim(), results: searchResultsRef.current ?? undefined });
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
      // Self-declared halal claims are retired (lib/presets.ts); old rows must not surface them here.
      m.tags?.forEach((t) => { if (!RETIRED_AMENITY_TAGS.includes(t)) allMore.add(t); });
      m.payment_methods?.forEach((p) => allMore.add(p));
    });
    return Array.from(allMore).sort();
  }, [merchants]);

  const browseGroups = useMemo(() => (["cuisine", "area"] as const).map((kind) => ({
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

      const matchesLabels = labels.every((label) =>
        label === "halal" ? m.features?.halal_certified === true : m.features?.vegetarian_options === true);

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

      return matchesCuisine && matchesState && matchesArea && matchesMore && matchesOpenNow && matchesLabels && searchMatch;
    });
  }, [activeCuisines, currentState, areaStates, activeArea, activeMore, openNow, labels, searchQuery, merchants, productIndex]);
  // A label chip appears only when at least one restaurant carries that label.
  const availableLabels = useMemo(() => [
    ...(merchants.some((m) => m.features?.halal_certified === true) ? ["halal"] : []),
    ...(merchants.some((m) => m.features?.vegetarian_options === true) ? ["veg"] : []),
  ], [merchants]);
  useEffect(() => {
    searchResultsRef.current = loading ? null : filtered.length;
  }, [loading, filtered]);

  const nearbySelection = useMemo(() => nearbyActive && coordinates
    ? selectNearby(filtered, coordinates.latitude, coordinates.longitude, nearbyRadiusKm)
    : null, [nearbyActive, coordinates, filtered, nearbyRadiusKm]);
  const nearbyOrAll = nearbySelection?.results.map((item) => item.merchant) ?? filtered;
  // Saved (R6) narrows whatever else is chosen; saved restaurants stay in nearest-first order.
  const visibleMerchants = savedOnly ? nearbyOrAll.filter((m) => savedSlugs.includes(m.slug)) : nearbyOrAll;
  const distanceById = new Map(nearbySelection?.results.map((item) => [item.merchant.id, item.distanceKm]) ?? []);
  const priceById = useMemo(
    () => new Map(merchants.map((m) => [m.id, priceRange(menuPrices.get(m.id) ?? [], m.currency)])),
    [merchants, menuPrices],
  );

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
      setLocationError("nearby.unavailable");
      return;
    }
    setNearbyLoading(true);
    navigator.geolocation.getCurrentPosition((position) => {
      if (locationRequestRef.current !== requestId) return;
      setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setNearbyActive(true);
      setNearbyLoading(false);
      // G19: Nearby works together with cuisine, state, area and Open now, so they stay as chosen.
    }, () => {
      if (locationRequestRef.current !== requestId) return;
      setCoordinates(null);
      setNearbyActive(false);
      setNearbyLoading(false);
      setLocationError("nearby.denied");
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
    setIsSearching(true);
    setActiveState(state);
    saveState(state);
    // An area from another state would hide every restaurant, so it is cleared.
    setActiveArea((area) => (area && state && areaStates.get(area) !== state ? null : area));
    setTimeout(() => setIsSearching(false), 300);
  }, [areaStates]);

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
    handleNearbyChange(false);
    setIsSearching(true);
    setSearchQuery("");
    setActiveCuisines([]);
    setActiveState(null);
    saveState(null);
    setActiveArea(null);
    setActiveMore([]);
    setOpenNow(false);
    setLabels([]);
    setSavedOnly(false);
    setTimeout(() => setIsSearching(false), 300);
  }, [handleNearbyChange]);

  const showLoading = loading || isSearching;

  const activeFilterCount =
    activeCuisines.length +
    (currentState ? 1 : 0) +
    (activeArea && activeArea !== "All Areas" ? 1 : 0) +
    activeMore.length +
    (openNow ? 1 : 0) +
    labels.length +
    (nearbyActive ? 1 : 0) +
    (savedOnly ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const resultsTitle = savedOnly ? t("filter.saved") : nearbySelection ? t("home.nearYou") : openNow ? t("filter.openNow") : activeFilterCount > 0 ? t("home.results") : t("home.restaurants");

  return (
    <main>
      <div className="mx-auto max-w-6xl px-4">
        <section className="flex flex-col gap-3.5 pb-2 pt-5 md:pt-10">
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] md:text-[40px]">
            {t("home.title")}
          </h1>
          <SearchInput
            label={t("home.searchLabel")}
            placeholder={t("home.search")}
            value={searchQuery}
            onChange={(event) => handleSearch(event.target.value)}
            wrapperClassName="md:max-w-xl"
          />
        </section>

        <HomeFilters
          nearbyActive={nearbyActive}
          nearbyLoading={nearbyLoading}
          onNearbyChange={handleNearbyChange}
          openNow={openNow}
          onOpenNowChange={handleOpenNowChange}
          availableLabels={availableLabels}
          labels={labels}
          onLabelsChange={setLabels}
          availableStates={availableStates}
          currentState={currentState}
          onStateChange={handleStateChange}
          availableAreas={availableAreas}
          activeArea={activeArea}
          onAreaChange={handleAreaChange}
          availableCuisines={availableCuisines}
          activeCuisines={activeCuisines}
          onCuisineChange={handleCuisineChange}
          availableMore={availableMore}
          activeMore={activeMore}
          onMoreChange={handleMoreChange}
          savedCount={savedSlugs.length}
          savedOnly={savedOnly}
          onSavedOnlyChange={setSavedOnly}
        />

        {locationError && <p role="status" className="pt-3 text-sm text-muted">{t(locationError)}</p>}
        {nearbySelection && (
          <div role="group" aria-label={t("nearby.distanceLabel")} className="flex flex-wrap items-center gap-2 pt-2 text-[13px] text-muted">
            <span>{t("nearby.within")}</span>
            {NEARBY_RADII_KM.map((km) => (
              <Chip key={km} selected={nearbyRadiusKm === km} onClick={() => setNearbyRadiusKm(km)} className="px-3">
                {t("nearby.km", { distance: km })}
              </Chip>
            ))}
          </div>
        )}

        <section aria-labelledby="results-heading" className="pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <SectionTitle id="results-heading">{resultsTitle}</SectionTitle>
            {!showLoading && (
              <p role="status" className="text-sm text-muted">
                {t(visibleMerchants.length === 1 ? "home.countOne" : "home.countMany", { count: visibleMerchants.length })}
                {activeFilterCount > 0 && (
                  <>
                    {" · "}
                    <button type="button" onClick={handleClearAll} className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-2 hover:underline">
                      {t("filter.clear")}
                    </button>
                  </>
                )}
              </p>
            )}
          </div>

          {showLoading ? (
            <div className="mt-3 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <MerchantCardSkeleton key={i} />)}
            </div>
          ) : visibleMerchants.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-lg font-bold">{t("home.none")}</p>
              <p className="mt-2 text-sm text-muted">
                {nearbySelection
                  ? nearbySelection.radiusKm < 10 ? t("home.nearbyNoneBody") : t("home.nearbyMaxNoneBody")
                  : savedOnly ? t("home.savedNoneBody") : t("home.noneBody")}
              </p>
              {activeFilterCount > 0 && (
                <button type="button" onClick={handleClearAll} className={`${buttonClasses({ variant: "primary", size: "lg" })} mt-5`}>
                  {t("filter.clearAll")}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {visibleMerchants.map((merchant) => (
                <MerchantCard key={merchant.id} merchant={merchant} distanceKm={distanceById.get(merchant.id)} priceText={priceById.get(merchant.id)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {browseGroups.some(({ groups }) => groups.length > 0) && (
        <section aria-label={t("home.browseLabel")} className="mx-auto max-w-6xl pt-9">
          {browseGroups.map(({ kind, groups }) => groups.length > 0 && (
            <div key={kind} className={kind === "area" ? "px-4 pt-6" : ""}>
              <SectionTitle className={kind === "cuisine" ? "px-4" : ""}>{kind === "cuisine" ? t("home.craving") : t("home.browseArea")}</SectionTitle>
              {kind === "cuisine" ? (
                <div className="mt-3 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                  {groups.map((group, index) => (
                    <a key={group.slug} href={discoveryPath(kind, group.slug)} className="flex w-[104px] shrink-0 flex-col items-center gap-1.5 text-ink">
                      <span aria-hidden className={`flex size-[104px] items-center justify-center rounded-[20px] text-3xl font-extrabold text-ink/30 ${CRAVING_TILES[index % CRAVING_TILES.length]}`}>
                        {group.label.charAt(0)}
                      </span>
                      <span className="line-clamp-2 text-center text-sm font-semibold leading-tight">{group.label}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {groups.map((group) => (
                    <a key={group.slug} href={discoveryPath(kind, group.slug)} className={chipClasses()}>
                      {group.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <LatestStories />

      <div className="mx-auto max-w-6xl px-4 pt-8">
        <section className="flex flex-col gap-3 rounded-3xl bg-brand px-5 py-[22px] text-white md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="text-xl font-extrabold leading-tight tracking-[-0.02em]">{t("home.joinTitle")}</p>
            <p className="mt-2 text-sm leading-normal text-[#D5E5DA]">{t("home.joinBody")}</p>
          </div>
          <Link href="/join-us" className={`${buttonClasses({ variant: "kaya", size: "lg" })} self-start md:self-center`}>
            {t("home.joinButton")}
          </Link>
        </section>
      </div>

      <Footer />
      <SiteAnnouncement />
    </main>
  );
}
