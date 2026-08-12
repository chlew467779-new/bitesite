import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StoreHero } from "@/components/sections/store-hero";
import { BrandIntro } from "@/components/sections/brand-intro";
import { MenuSection } from "@/components/sections/menu-section";
import { InfoAccordion } from "@/components/sections/info-accordion";
import { VideoSection } from "@/components/sections/video-section";
import { StoreFooter } from "@/components/sections/store-footer";
import { TextImageBlock } from "@/components/sections/text-image-block";
import { DiscoverBiteSite } from "@/components/sections/discover-bitesite";
import { getStyleConfig } from "@/lib/styles";
import type { Merchant, Category, Product } from "@/types";

// ========== DEMO DATA ==========
const DEMO_MERCHANTS: Record<string, Merchant> = {
  "the-brew-barn": {
    id: "1",
    slug: "the-brew-barn",
    name: "The Brew Barn",
    description:
      "A cozy neighborhood cafe serving specialty coffee and all-day brunch in the heart of Bangsar.\nKnown for our signature cold brew and sourdough toast, we source beans directly from local roasters and bake our bread fresh every morning.",
    cuisine_type: "Cafe, Brunch",
    address: "12 Jalan Telawi 3, Bangsar, 59100 Kuala Lumpur",
    phone: "+60 3-2201 2345",
    whatsapp: "+60123456789",
    email: "hello@thebrewbarn.my",
    website: "https://thebrewbarn.my",
    instagram: "https://instagram.com/thebrewbarn",
    facebook: null,
    cover_image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80",
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
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    video_type: "youtube",
    video_caption: "Take a tour of our cozy Bangsar space",
    reference_website: null,
    custom_style: false,
    style: "fresh",
    is_published: true,
    created_at: "2026-08-01T00:00:00Z",
  },
  "sage-western-grill": {
    id: "2",
    slug: "sage-western-grill",
    name: "Sage Western Grill",
    description:
      "An intimate dining experience where modern Western cuisine meets artisanal craftsmanship.\nEvery cut of meat is dry-aged in-house, every pasta sheet is rolled by hand, and every plate is a canvas. Welcome to Sage.",
    cuisine_type: "Western, Fine Dining",
    address: "45 Jalan Damansara, Taman Tun Dr Ismail, 60000 Kuala Lumpur",
    phone: "+60 3-7733 4567",
    whatsapp: "+60198765432",
    email: "reservations@sagegrill.my",
    website: null,
    instagram: "https://instagram.com/sagewesterngill",
    facebook: null,
    cover_image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
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
  "matcha-mornings": {
    id: "3",
    slug: "matcha-mornings",
    name: "Matcha Mornings",
    description:
      "静かな朝のひとときを。\nA peaceful morning retreat where Japanese tea culture meets contemporary dessert artistry. Every bowl of matcha is whisked to order, every parfait is assembled with seasonal precision.",
    cuisine_type: "Dessert, Japanese",
    address: "78 Jalan SS15/4E, Subang Jaya, 47500 Selangor",
    phone: "+60 3-5611 7890",
    whatsapp: "+60155667788",
    email: "hello@matchamornings.my",
    website: null,
    instagram: "https://instagram.com/matchamornings",
    facebook: null,
    cover_image: "https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=1200&q=80",
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
};

const DEMO_CATEGORIES: Record<string, Category[]> = {
  "the-brew-barn": [
    { id: "c1", merchant_id: "1", name: "All-Day Brunch", sort_order: 0, created_at: "" },
    { id: "c2", merchant_id: "1", name: "Coffee & Beverages", sort_order: 1, created_at: "" },
    { id: "c3", merchant_id: "1", name: "Pastries", sort_order: 2, created_at: "" },
  ],
  "sage-western-grill": [
    { id: "c1", merchant_id: "2", name: "Starters", sort_order: 0, created_at: "" },
    { id: "c2", merchant_id: "2", name: "From The Grill", sort_order: 1, created_at: "" },
    { id: "c3", merchant_id: "2", name: "Desserts", sort_order: 2, created_at: "" },
  ],
  "matcha-mornings": [
    { id: "c1", merchant_id: "3", name: "抹茶 Specials", sort_order: 0, created_at: "" },
    { id: "c2", merchant_id: "3", name: "Parfait", sort_order: 1, created_at: "" },
    { id: "c3", merchant_id: "3", name: "お茶", sort_order: 2, created_at: "" },
  ],
};

const DEMO_PRODUCTS: Record<string, Product[]> = {
  "the-brew-barn": [
    { id: "p1", category_id: "c1", merchant_id: "1", name: "Sourdough Avocado Toast", description: "House-made sourdough, smashed avocado, poached eggs, chili flakes, microgreens", price: 28.00, image_url: "https://images.unsplash.com/photo-1588137372308-15f75323ca8d?w=600&q=80", is_featured: true, sort_order: 0, created_at: "" },
    { id: "p2", category_id: "c1", merchant_id: "1", name: "Big Breakfast Platter", description: "Eggs any style, beef bacon, chicken sausage, sautéed mushrooms, roasted tomatoes, sourdough", price: 38.00, image_url: "https://images.unsplash.com/photo-1533089862017-5614ec87e284?w=600&q=80", is_featured: true, sort_order: 1, created_at: "" },
    { id: "p3", category_id: "c1", merchant_id: "1", name: "Granola Bowl", description: "Greek yogurt, house granola, seasonal fruits, honey drizzle", price: 22.00, image_url: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=600&q=80", is_featured: false, sort_order: 2, created_at: "" },
    { id: "p4", category_id: "c2", merchant_id: "1", name: "Signature Cold Brew", description: "24-hour steeped cold brew, served over ice with a hint of vanilla", price: 16.00, image_url: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80", is_featured: true, sort_order: 0, created_at: "" },
    { id: "p5", category_id: "c2", merchant_id: "1", name: "Flat White", description: "Double ristretto, silky steamed milk, latte art", price: 14.00, image_url: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&q=80", is_featured: false, sort_order: 1, created_at: "" },
    { id: "p6", category_id: "c3", merchant_id: "1", name: "Almond Croissant", description: "Buttery croissant filled with almond cream, topped with flaked almonds", price: 12.00, image_url: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80", is_featured: true, sort_order: 0, created_at: "" },
  ],
  "sage-western-grill": [
    { id: "p1", category_id: "c1", merchant_id: "2", name: "Truffle Mushroom Soup", description: "Creamy wild mushroom soup with black truffle oil and toasted sourdough croutons", price: 34.00, image_url: "https://images.unsplash.com/photo-1547592166-23acbe3a624b?w=600&q=80", is_featured: true, sort_order: 0, created_at: "" },
    { id: "p2", category_id: "c1", merchant_id: "2", name: "Beef Carpaccio", description: "Thinly sliced beef tenderloin, parmesan shavings, arugula, capers, lemon vinaigrette", price: 48.00, image_url: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600&q=80", is_featured: true, sort_order: 1, created_at: "" },
    { id: "p3", category_id: "c2", merchant_id: "2", name: "28-Day Dry-Aged Ribeye", description: "300g Australian ribeye, roasted garlic butter, seasonal vegetables, truffle mash", price: 188.00, image_url: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=600&q=80", is_featured: true, sort_order: 0, created_at: "" },
    { id: "p4", category_id: "c2", merchant_id: "2", name: "Whole Boston Lobster", description: "Grilled lobster, lemon herb butter, saffron risotto, asparagus", price: 228.00, image_url: "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=600&q=80", is_featured: true, sort_order: 1, created_at: "" },
    { id: "p5", category_id: "c3", merchant_id: "2", name: "Crème Brûlée", description: "Madagascar vanilla bean custard, caramelized sugar crust, fresh berries", price: 28.00, image_url: "https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=600&q=80", is_featured: false, sort_order: 0, created_at: "" },
    { id: "p6", category_id: "c3", merchant_id: "2", name: "Chocolate Fondant", description: "Valrhona dark chocolate lava cake, vanilla bean ice cream, raspberry coulis", price: 32.00, image_url: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600&q=80", is_featured: false, sort_order: 1, created_at: "" },
  ],
  "matcha-mornings": [
    { id: "p1", category_id: "c1", merchant_id: "3", name: "Ceremonial Matcha Latte", description: "Premium Uji matcha, steamed milk, hand-whisked to order", price: 18.00, image_url: "https://images.unsplash.com/photo-1515823662972-da6a2e4d3114?w=600&q=80", is_featured: true, sort_order: 0, created_at: "" },
    { id: "p2", category_id: "c1", merchant_id: "3", name: "Matcha Tiramisu", description: "Layers of matcha-soaked ladyfingers, mascarpone cream, dusted with matcha powder", price: 24.00, image_url: "https://images.unsplash.com/photo-1563729768-6af784d6df1a?w=600&q=80", is_featured: true, sort_order: 1, created_at: "" },
    { id: "p3", category_id: "c2", merchant_id: "3", name: "Hojicha Parfait", description: "Hojicha ice cream, roasted soybean flour mochi, red bean paste, whipped cream, chestnut", price: 28.00, image_url: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80", is_featured: true, sort_order: 0, created_at: "" },
    { id: "p4", category_id: "c2", merchant_id: "3", name: "Seasonal Fruit Parfait", description: "Matcha soft serve, seasonal fresh fruits, granola, honey, edible flowers", price: 26.00, image_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80", is_featured: false, sort_order: 1, created_at: "" },
    { id: "p5", category_id: "c3", merchant_id: "3", name: "Gyokuro Cold Brew", description: "Shaded-grown premium green tea, cold-brewed for 8 hours, served in a wine glass", price: 22.00, image_url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80", is_featured: false, sort_order: 0, created_at: "" },
    { id: "p6", category_id: "c3", merchant_id: "3", name: "Genmaicha", description: "Roasted brown rice green tea, served in a traditional ceramic pot with cup", price: 14.00, image_url: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&q=80", is_featured: false, sort_order: 1, created_at: "" },
  ],
};

const FEATURED_DATA: Record<string, { title: string; desc: string; image: string }> = {
  "the-brew-barn": {
    title: "Signature Dishes",
    desc: "Our kitchen team crafts every dish with locally sourced ingredients and a passion for bold flavors. From our house-made sourdough to our specialty coffee blends, every item on our menu tells a story of quality and care.",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
  },
  "sage-western-grill": {
    title: "The Art of Dry Aging",
    desc: "Our dedicated dry-aging room maintains precise temperature and humidity for 28 days, transforming prime cuts into something extraordinary. The result is a depth of flavor that simply cannot be rushed.",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
  },
  "matcha-mornings": {
    title: "一期一会",
    desc: "Each visit is a unique encounter. Our matcha is sourced directly from Uji, Kyoto, and our hojicha is roasted in small batches. We believe in the beauty of impermanence — our menu changes with the seasons, honoring what nature provides.",
    image: "https://images.unsplash.com/photo-1515823662972-da6a2e4d3114?w=800&q=80",
  },
};

interface Props {
  params: { merchant: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { merchant } = params;
  const data = DEMO_MERCHANTS[merchant];

  if (!data) {
    return { title: "Not Found | BiteSite" };
  }

  const title = `${data.name} | ${data.cuisine_type || "Restaurant"} in KL`;
  const description =
    data.description?.replace(/\n/g, " ").slice(0, 150) ||
    `Discover ${data.name} in Kuala Lumpur. Browse the menu, view photos, and get directions.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: data.cover_image ? [data.cover_image] : [],
      type: "website",
      locale: "en_MY",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: data.cover_image ? [data.cover_image] : [],
    },
    alternates: {
      canonical: `https://bitesite.my/store/${merchant}`,
    },
  };
}

export default async function StorePage({ params }: Props) {
  const { merchant } = params;
  const data = DEMO_MERCHANTS[merchant];

  if (!data) {
    notFound();
  }

  const style = getStyleConfig(data.style);
  const categories = DEMO_CATEGORIES[merchant] || [];
  const products = DEMO_PRODUCTS[merchant] || [];
  const featured = FEATURED_DATA[merchant];
  const productsByCategory = (catId: string) => products.filter((p) => p.category_id === catId);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: data.name,
    description: data.description?.replace(/\n/g, " "),
    image: data.cover_image,
    address: {
      "@type": "PostalAddress",
      streetAddress: data.address,
      addressLocality: "Kuala Lumpur",
      addressCountry: "MY",
    },
    telephone: data.phone,
    url: `https://bitesite.my/store/${merchant}`,
    servesCuisine: data.cuisine_type,
    openingHoursSpecification: data.operating_hours
      ? Object.entries(data.operating_hours).map(([day, hours]) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: day.charAt(0).toUpperCase() + day.slice(1),
          description: hours,
        }))
      : undefined,
  };

  return (
    <main style={{ backgroundColor: style.bg, color: style.text, fontFamily: style.fontSans }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StoreHero merchant={data} style={style} />
      <BrandIntro merchant={data} style={style} />

      {featured && (
        <TextImageBlock
          title={featured.title}
          description={featured.desc}
          imageUrl={featured.image}
          imageAlt={`${featured.title} at ${data.name}`}
          style={style}
        />
      )}

      <VideoSection merchant={data} style={style} />

      {categories.map((cat) => (
        <MenuSection
          key={cat.id}
          category={cat}
          products={productsByCategory(cat.id)}
          merchantName={data.name}
          style={style}
        />
      ))}

      <InfoAccordion merchant={data} style={style} />
      <DiscoverBiteSite style={style} />
      <StoreFooter merchant={data} style={style} />
    </main>
  );
}
