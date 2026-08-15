"use client";

import { useState, useEffect, useMemo } from "react";
import { Hero } from "@/components/sections/hero";
import { CategoryFilter } from "@/components/sections/category-filter";
import { MerchantCard } from "@/components/sections/merchant-card";
import { Footer } from "@/components/sections/footer";
import { supabase } from "@/lib/supabase";
import { FadeIn, StaggerItem } from "@/app/components/animations";
import type { Merchant } from "@/types";

export default function HomePage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

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

  const filtered = useMemo(() => {
    return merchants.filter((m) => {
      const matchesCategory =
        activeCategory === "All" ||
        (m.cuisine_type || "").toLowerCase().includes(activeCategory.toLowerCase());
      const q = searchQuery.toLowerCase();
      const searchMatch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.cuisine_type || "").toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q);
      return matchesCategory && searchMatch;
    });
  }, [activeCategory, searchQuery, merchants]);

  return (
    <main>
      <Hero onSearch={setSearchQuery} />
      <CategoryFilter active={activeCategory} onChange={setActiveCategory} />

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="py-20 text-center text-[#8A968B]">
              <div className="inline-block w-8 h-8 border-2 border-[#5A8F6E] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg">Loading restaurants...</p>
            </div>
          ) : filtered.length === 0 ? (
            <FadeIn>
              <div className="py-20 text-center text-[#8A968B]">
                <p className="text-lg">No restaurants found.</p>
                <p className="mt-2 text-sm">Try adjusting your search or category filter.</p>
              </div>
            </FadeIn>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((merchant, index) => (
                <StaggerItem key={`${merchant.id}-${activeCategory}-${searchQuery}`} index={index}>
                  <MerchantCard merchant={merchant} />
                </StaggerItem>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
