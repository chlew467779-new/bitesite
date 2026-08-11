"use client";

import { useState, useMemo } from "react";
import { Hero } from "@/components/sections/hero";
import { CategoryFilter } from "@/components/sections/category-filter";
import { MerchantCard } from "@/components/sections/merchant-card";
import { Footer } from "@/components/sections/footer";
import type { Merchant } from "@/types";

const DEMO_MERCHANTS: Merchant[] = [
  {
    id: "1",
    slug: "the-brew-barn",
    name: "The Brew Barn",
    description:
      "A cozy neighborhood cafe serving specialty coffee and all-day brunch in the heart of Bangsar. Known for our signature cold brew and sourdough toast.",
    cuisine_type: "Cafe",
    address: "12 Jalan Telawi 3, Bangsar, 59100 Kuala Lumpur",
    phone: "+60 3-2201 2345",
    whatsapp: "+60123456789",
    email: "hello@thebrewbarn.my",
    website: "https://thebrewbarn.my",
    instagram: "https://instagram.com/thebrewbarn",
    facebook: null,
    cover_image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80",
    logo_image: null,
    operating_hours: {
      monday: "8:00 AM - 6:00 PM",
      tuesday: "8:00 AM - 6:00 PM",
      wednesday: "8:00 AM - 6:00 PM",
      thursday: "8:00 AM - 6:00 PM",
      friday: "8:00 AM - 10:00 PM",
      saturday: "9:00 AM - 10:00 PM",
      sunday: "9:00 AM - 6:00 PM",
    },
    dress_code: "Casual",
    menu_pdf_url: null,
    video_url: null,
    video_type: "none",
    video_caption: null,
    reference_website: null,
    custom_style: false,
    style: "fresh",
    is_published: true,
    created_at: "2026-08-01T00:00:00Z",
  },
  {
    id: "2",
    slug: "sage-western-grill",
    name: "Sage Western Grill",
    description:
      "An intimate dining experience where modern Western cuisine meets artisanal craftsmanship. Every cut of meat is dry-aged in-house.",
    cuisine_type: "Western",
    address: "45 Jalan Damansara, Taman Tun Dr Ismail, 60000 Kuala Lumpur",
    phone: "+60 3-7733 4567",
    whatsapp: "+60198765432",
    email: "reservations@sagegrill.my",
    website: null,
    instagram: "https://instagram.com/sagewesterngill",
    facebook: null,
    cover_image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
    logo_image: null,
    operating_hours: {
      monday: "Closed",
      tuesday: "6:00 PM - 11:00 PM",
      wednesday: "6:00 PM - 11:00 PM",
      thursday: "6:00 PM - 11:00 PM",
      friday: "6:00 PM - 12:00 AM",
      saturday: "6:00 PM - 12:00 AM",
      sunday: "12:00 PM - 3:00 PM, 6:00 PM - 11:00 PM",
    },
    dress_code: "Smart Casual",
    menu_pdf_url: null,
    video_url: null,
    video_type: "none",
    video_caption: null,
    reference_website: null,
    custom_style: false,
    style: "luxury",
    is_published: true,
    created_at: "2026-08-05T00:00:00Z",
  },
  {
    id: "3",
    slug: "matcha-mornings",
    name: "Matcha Mornings",
    description:
      "A peaceful morning retreat where Japanese tea culture meets contemporary dessert artistry. Every bowl of matcha is whisked to order.",
    cuisine_type: "Dessert",
    address: "78 Jalan SS15/4E, Subang Jaya, 47500 Selangor",
    phone: "+60 3-5611 7890",
    whatsapp: "+60155667788",
    email: "hello@matchamornings.my",
    website: null,
    instagram: "https://instagram.com/matchamornings",
    facebook: null,
    cover_image: "https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=800&q=80",
    logo_image: null,
    operating_hours: {
      monday: "Closed",
      tuesday: "11:00 AM - 10:00 PM",
      wednesday: "11:00 AM - 10:00 PM",
      thursday: "11:00 AM - 10:00 PM",
      friday: "11:00 AM - 11:00 PM",
      saturday: "10:00 AM - 11:00 PM",
      sunday: "10:00 AM - 10:00 PM",
    },
    dress_code: "Casual",
    menu_pdf_url: null,
    video_url: null,
    video_type: "none",
    video_caption: null,
    reference_website: null,
    custom_style: false,
    style: "japanese",
    is_published: true,
    created_at: "2026-08-08T00:00:00Z",
  },
];

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return DEMO_MERCHANTS.filter((m) => {
      const matchesCategory =
        activeCategory === "All" || m.cuisine_type === activeCategory;
      const q = searchQuery.toLowerCase();
      const searchMatch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.cuisine_type || "").toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q);
      return matchesCategory && searchMatch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <main>
      <Hero onSearch={setSearchQuery} />
      <CategoryFilter active={activeCategory} onChange={setActiveCategory} />

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-[#8A968B]">
              <p className="text-lg">No restaurants found.</p>
              <p className="mt-2 text-sm">Try adjusting your search or category filter.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((merchant) => (
                <MerchantCard key={merchant.id} merchant={merchant} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
