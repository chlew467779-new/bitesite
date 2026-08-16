# BiteSite #

Beautiful Menus for Local Restaurants — Kuala Lumpur, Malaysia.

> **Live URL**: https://bitesite-pied.vercel.app  
> **GitHub**: https://github.com/chlew467779-new/bitesite  
> **Owner**: CH (BiteSite)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |
| Icons | Lucide React |
| Fonts | Inter, Playfair Display, Noto Sans JP |

---

## Project Structure
## Note: When creating any new modules or code , please insert 1 line of comment on the top stating the path of the code.
##       for example : bitesite/components/sections/latest-stories.tsx
```
app/
├── page.tsx                    # Homepage — merchant grid + filters
├── layout.tsx                  # Root layout (fonts + metadata + SEO)
├── globals.css                 # Tailwind v4 + CSS custom properties
├── sitemap.ts                  # Auto-generated sitemap.xml
├── robots.ts                   # robots.txt
├── loading.tsx                 # Global loading fallback (unused)
├── api/
│   └── view/
│       └── route.ts            # POST /api/view — increment view count
├── store/
│   └── [merchant]/
│       ├── page.tsx              # Merchant detail page (ISR + SSR + Schema.org)
│       └── loading.tsx           # Merchant page skeleton (hero + menu + categories)
├── layouts/
│   ├── index.ts                  # Layout registry (classic/elegant/minimal/modern/rustic)
│   ├── classic-layout.tsx        # Warm amber cafe style
│   ├── elegant-layout.tsx        # Dark luxury fine-dining style
│   ├── minimal-layout.tsx        # Clean stone/zen style
│   ├── modern-layout.tsx         # White slate contemporary style
│   └── rustic-layout.tsx         # Orange earthy style
└── components/
    ├── safe-image.tsx            # Next/Image wrapper with error fallback + loading shimmer
    └── animations.tsx            # FadeIn (IntersectionObserver), StaggerContainer, StaggerItem

components/
├── ui/
│   ├── cuisine-tag.tsx           # Pill-shaped cuisine label (border + text color customizable)
│   └── diamond-separator.tsx     # Decorative divider (◆)
└── sections/
    ├── hero.tsx                  # Homepage hero with search bar + pattern bg
    ├── category-filter.tsx       # 3-row sticky filter bar (Open Now / Cuisine / Area / More)
    ├── merchant-card.tsx         # Card: Open Now badge + ShareMenu + ViewCount + tags + hours
    ├── merchant-card-skeleton.tsx # Loading skeleton with pulse animation
    ├── footer.tsx                # Site footer (BiteSite branding + copyright)
    ├── brand-intro.tsx           # Merchant brand intro (old 3-style system, still used)
    ├── discover-bitesite.tsx     # "Discover more" CTA link to homepage
    ├── info-accordion.tsx        # Location / Hours / Dress Code / Social accordion
    ├── menu-section.tsx          # Category-based menu grid (delegates to ProductCard)
    ├── product-card.tsx          # Individual dish card with image, price, discount, availability
    ├── related-merchants.tsx     # "You May Also Like" recommendations (scored algorithm)
    ├── share-menu.tsx            # Floating share menu (WhatsApp/FB/Twitter/Copy/IG)
    ├── share-buttons.tsx         # Inline share buttons (merchant page contact section)
    ├── view-tracker.tsx          # Client-side view count tracker (2s delay POST)
    ├── view-count-inline.tsx     # Eye icon + formatted count badge (sm/md)
    ├── store-hero.tsx            # Full-bleed hero image (old style system)
    ├── store-footer.tsx          # Merchant footer with WhatsApp CTA
    ├── text-image-block.tsx      # Alternating text/image section (about)
    └── video-section.tsx         # YouTube embed + self-hosted video player

components/sections/ (Tier Sections — optional per merchant)
├── gallery-section.tsx         # Photo grid with lightbox (prev/next, counter, keyboard nav)
├── reviews-section.tsx         # Customer reviews display + submit form (mock/pending)
├── appointment-section.tsx     # Table reservation form → sends WhatsApp to BiteSite
├── seasonal-section.tsx        # Featured/limited-time items with "LIMITED TIME ONLY" badge
├── events-section.tsx          # Event cards with date badge (month + day)
└── tier-sections.tsx           # Orchestrates all tier sections based on features flags

lib/
├── supabase.ts                 # Supabase client + all DB queries + related merchant scoring
├── hours.ts                    # Timezone-safe open/closed logic (Asia/Kuala_Lumpur)
├── utils.ts                    # cn() — clsx + tailwind-merge
└── styles.ts                   # OLD 3-style theme map (fresh/luxury/japanese) — DEPRECATED

types/
└── index.ts                    # All TypeScript interfaces + defaultFeatures + mergeFeatures
```

---

## Database Schema

### `merchants` (main table)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| slug | TEXT | URL-friendly name, unique, indexed |
| name | TEXT | Restaurant name |
| description | TEXT | Long description, supports newlines |
| cuisine_type | TEXT | Comma-separated e.g. "Cafe, Western" |
| address | TEXT | Full address |
| phone | TEXT | Display phone number |
| whatsapp | TEXT | WhatsApp number (digits only for wa.me link) |
| email | TEXT | Contact email |
| website | TEXT | External website URL |
| instagram | TEXT | Instagram URL |
| facebook | TEXT | Facebook URL |
| cover_image | TEXT | Hero image URL (used for OG image) |
| logo_image | TEXT | Logo URL |
| operating_hours | JSONB | `{monday: "9:00 AM - 10:00 PM", ...}` |
| dress_code | TEXT | Optional dress code info |
| menu_pdf_url | TEXT | PDF menu link |
| video_url | TEXT | Single video URL (legacy field) |
| video_type | TEXT | "youtube" / "self_hosted" / "none" |
| video_caption | TEXT | Video caption |
| reference_website | TEXT | Reference/inspiration URL |
| custom_style | JSONB | Custom CSS overrides (reserved) |
| style | TEXT | **DEPRECATED** — old 3-style system (fresh/luxury/japanese) |
| layout | TEXT | **ACTIVE** — 5 layouts (classic/elegant/minimal/modern/rustic) |
| features | JSONB | Tier feature toggles |
| settings | JSONB | Misc merchant settings |
| status | TEXT | e.g. "active" |
| area | TEXT | District/area e.g. "Desa ParkCity", "Bangsar" |
| tags | TEXT[] | Array of tags e.g. ["Halal", "Pet Friendly", "WiFi"] |
| payment_methods | TEXT[] | ["Cash", "Cashless", "Cards"] |
| is_published | BOOLEAN | Only published merchants appear on site |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Used for sitemap lastModified |

### `categories`
| Column | Type |
|--------|------|
| id | UUID PK |
| merchant_id | UUID → merchants (ON DELETE CASCADE) |
| name | TEXT | Category name e.g. "Starters", "Mains" |
| sort_order | INT | Display order |
| created_at | TIMESTAMPTZ |

### `products`
| Column | Type |
|--------|------|
| id | UUID PK |
| category_id | UUID → categories |
| merchant_id | UUID → merchants |
| name | TEXT | Dish name |
| description | TEXT | Dish description |
| price | NUMERIC | Regular price |
| discount_price | NUMERIC | Sale price (shows strikethrough original) |
| image_url | TEXT | Product photo |
| is_featured | BOOLEAN | Appears in Seasonal tier |
| is_available | BOOLEAN | Shows "Unavailable" badge if false |
| show_prices | BOOLEAN | Whether to display price |
| sort_order | INT | Display order within category |
| created_at | TIMESTAMPTZ |

### `merchant_videos`
| Column | Type |
|--------|------|
| id | UUID PK |
| merchant_id | UUID → merchants (ON DELETE CASCADE) |
| video_url | TEXT | YouTube URL or direct video URL |
| video_type | TEXT | "youtube" / "self_hosted" |
| caption | TEXT | Video caption below player |
| sort_order | INT | Display order |
| created_at | TIMESTAMPTZ |

### `merchant_stats` (view count analytics)
| Column | Type |
|--------|------|
| slug | TEXT PK | Same as merchants.slug |
| view_count | INT DEFAULT 0 | Total lifetime views |
| last_viewed_at | TIMESTAMPTZ | Last view timestamp |

### `merchant_monthly_views` (monthly analytics — reserved)
| Column | Type |
|--------|------|
| id | SERIAL PK |
| slug | TEXT | Merchant slug |
| year_month | TEXT | Format "YYYY-MM" |
| view_count | INT DEFAULT 0 | Views for that month |
| UNIQUE(slug, year_month) | Composite unique constraint |

### Supabase RPC Functions
```sql
-- Increment view count (upserts merchant_stats + inserts/updates merchant_monthly_views)
increment_view_count(merchant_slug TEXT) RETURNS void
```

---

## Merchant Detail Page (`/store/[merchant]`)

### Rendering Strategy
- **ISR**: `export const revalidate = 300` — pages revalidate every 5 minutes
- **Static Generation**: `generateStaticParams()` fetches all published merchants at build time
- **SSR Fallback**: If merchant not in static params, renders on-demand (ISR handles it)

### Metadata Generation (`generateMetadata`)
- Dynamic title: `{name} | {cuisine} Menu | BiteSite`
- Dynamic description: truncated to 155 chars from `merchant.description`
- OG image: `merchant.cover_image` (absolute URL)
- Canonical URL: `https://bitesite-pied.vercel.app/store/{slug}`
- Keywords: merchant name + cuisine + "menu" + "Kuala Lumpur"

### Schema.org JSON-LD
Two structured data blocks injected via `<script type="application/ld+json">`:

1. **Restaurant Schema** (`@type: "Restaurant"`)
   - name, image, description, priceRange
   - address (PostalAddress with streetAddress, addressLocality: "Kuala Lumpur", addressCountry: "MY")
   - telephone, servesCuisine, openingHours (formatted as "Mo 9:00 AM - 10:00 PM")

2. **BreadcrumbList Schema**
   - Position 1: Home → `/`
   - Position 2: Merchant name → `/store/{slug}`

### Page Data Fetching (parallel)
```
Promise.all([
  getCategoriesByMerchant(merchant.id),
  getProductsByMerchant(merchant.id),
  getVideosByMerchant(merchant.id),
  getRelatedMerchants(slug, cuisine, tags, area, 3),
  supabase.from("merchant_stats").select("view_count").eq("slug", slug).single()
])
```

### Components Rendered
1. `<ViewTracker slug={...} />` — invisible, fires view count after 2s
2. Schema.org scripts (Restaurant + BreadcrumbList)
3. `<LayoutComponent />` — chosen by `merchant.layout` (classic/elegant/minimal/modern/rustic)
4. `<RelatedMerchants />` — "You May Also Like" section at bottom

### Loading State
`loading.tsx` provides a skeleton with:
- Hero placeholder (h-64 to h-96)
- Title + description lines (pulse animation)
- 3 menu categories × 3 products each (image + text skeletons)

---

## 5 Merchant Layouts

Each merchant picks ONE layout via `merchants.layout` column.

| Layout | Vibe | Primary Colors | Hero Style |
|--------|------|----------------|------------|
| **classic** | Warm cafe / bakery | Amber-50 bg, amber-900 text, green accents | Full-bleed image with gradient overlay, sticky back nav |
| **elegant** | Dark luxury fine-dining | Slate-950 bg, amber-300/gold accents, white text | Full-bleed image with dark gradient, **scroll nav** (Menu/Hours/Gallery/Reserve/Reviews/Events tabs) |
| **minimal** | Clean zen / Japanese | Stone-50 bg, stone-800 text, minimal borders | 16:9 image above text, no overlay, "Back" only (short text) |
| **modern** | Contemporary urban | White bg, slate-900 text, slate-100 accents | 2-column: text left, image right, rounded-2xl |
| **rustic** | Earthy / farm-to-table | Orange-50 bg, orange-900 text, warm tones | Full-bleed image with white card overlapping bottom |

### Layout Shared Features
- **Sticky Back Nav**: All layouts have "Back to BiteSite" sticky header
- **Scroll Nav** (Elegant only): Tab bar with smooth-scroll to sections
- **ViewCount badge**: Inline eye icon next to cuisine tag in Hero (if > 0 views)
- **Share buttons**: Inline row in Contact section (Copy Link + WhatsApp + FB + Twitter + Instagram)
- **Payment Methods**: Icon pills (Cash/Cashless/Cards) in Contact section
- **Related Merchants**: "You May Also Like" at bottom, auto-themed to match current layout

---

## 9 Tier Features (Optional Per Merchant)

Controlled via `merchants.features` JSONB.

```typescript
interface MerchantFeatures {
  hero: boolean;           // default true
  about: boolean;          // default true
  menu: boolean;           // default true
  contact: boolean;        // default true
  gallery: boolean;        // default false
  reviews: boolean;        // default false
  appointment: boolean;    // default false
  seasonal_popup: boolean;   // default false
  events: boolean;         // default false
}
```

| Tier | Description | Data Source | Layout Integration |
|------|-------------|-------------|-------------------|
| **Hero** | Cover image + name + cuisine + today hours | `cover_image`, `cuisine_type` | Layout-specific hero component |
| **About** | Description paragraph | `description` | Layout-specific text block |
| **Menu** | Categories → Products grid with images/prices | `categories` + `products` tables | Layout-specific menu rendering |
| **Contact** | Hours table + address/phone/WhatsApp/email/IG + Payment Methods + Share | `operating_hours`, `address`, `phone`, etc. | Layout-specific contact section |
| **Gallery** | Photo grid with lightbox (prev/next, counter, keyboard nav) | `cover_image` + all `product.image_url` | `<GallerySection>` |
| **Reviews** | Display reviews + submit form (mock — pending approval) | Hardcoded empty array `[]` | `<ReviewsSection>` |
| **Appointment** | Table booking form → sends WhatsApp message to BiteSite | Hardcoded WhatsApp: `60165660239` | `<AppointmentSection>` |
| **Seasonal** | Featured products highlighted as "LIMITED TIME ONLY" | `products` where `is_featured = true` | `<SeasonalSection>` |
| **Events** | Event cards with date badge (month + day) | Hardcoded empty array `[]` | `<EventsSection>` |

### Tier Section Orchestration (`tier-sections.tsx`)
- Gallery images = `cover_image` + all product images (deduplicated)
- Seasonal items = featured products mapped to `{id, name, description, image, price, period}`
- Reviews/Events currently use hardcoded empty arrays (future: connect to DB tables)

---

## Homepage (`/`)

### Search & Filter
- **Search bar**: Real-time search by name, cuisine, description, tags
- **Open Now**: Toggle to show only currently-open restaurants (timezone: Asia/Kuala_Lumpur)
- **Cuisine filters**: Cafe, Western, Asian, Dessert, Japanese, Bakery (multi-select)
- **Area filters**: Dynamically generated from `merchants.area` column (includes "All Areas")
- **More filters**: Halal, Cash, Cashless, Cards (multi-select)
- **Active filter count**: Shows "X filters active" badge + "Clear All" button
- **Loading state**: Skeleton cards with staggered pulse animation

### Merchant Cards
- **Open Now badge**: Green (open) or dark (closed) pill, top-left of image
- **Share Menu**: Top-right floating button — WhatsApp / Facebook / Twitter / Copy Link / Instagram (copy)
- **View Count**: Bottom-right eye icon + formatted number (only if > 0)
- **Tags**: Primary cuisine tag + up to 3 merchant tags
- **Hours**: "Today: X:XX AM - X:XX PM"
- **Hover effects**: Image zoom (scale-105), shadow lift

### Related Merchants Algorithm (`getRelatedMerchants`)
Scoring system (highest first):
1. Currently open (+20 points)
2. Same cuisine_type (+10)
3. Overlapping tags (+3 per tag)
4. Same area (+5)

Returns top N (default 3) scored merchants.

---

## View Count System

- **Tracking**: `<ViewTracker>` component ("use client") fires `POST /api/view` after 2-second delay
- **API**: `app/api/view/route.ts` — validates slug, calls `increment_view_count()` RPC
- **Database**: `increment_view_count()` upserts `merchant_stats` (total) + `merchant_monthly_views` (monthly)
- **Display locations**:
  - Merchant page Hero: inline eye badge next to cuisine tag
  - Homepage cards: bottom-right eye badge (only if viewCount > 0)
  - Related merchants: not shown (keeps cards clean)

---

## SEO & Performance

- **Meta tags**: Auto-generated per merchant (title, description, keywords, OG, Twitter)
- **Canonical URLs**: `https://bitesite-pied.vercel.app/store/{slug}`
- **Schema.org**: JSON-LD Restaurant + BreadcrumbList on every merchant page
- **Sitemap**: Auto-generated from all published merchants (`sitemap.ts`)
- **Robots**: Allow all, sitemap linked (`robots.ts`)
- **Google Search Console**: Verified
- **Image optimization**: `unoptimized: true` in next.config.js (Vercel free tier)
- **Lazy loading**: Images use `loading="lazy"` except hero (priority)

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon/public key
```

---

## Key Business Rules

1. **No cart, no checkout, no auth** — pure showcase platform
2. **BiteSite branding is minimal** — only "Discover more restaurants on BiteSite" at bottom of merchant pages
3. **Each merchant has independent visual identity** — layout + colors are per-merchant
4. **WhatsApp is the primary CTA** — reservations route to merchant's WhatsApp; appointment form routes to BiteSite's WhatsApp (`60165660239`)
5. **cuisine_type supports comma-separated multi-values** — e.g. "Cafe, Western" (first value used as primary tag)
6. **Payment methods** stored as array: `["Cash", "Cashless", "Cards"]` — displayed with icons
7. **Operating hours** stored as JSONB — supports single and split hours (comma-separated)
8. **Tags** are free-text array — used for filtering (Halal, Pet Friendly, WiFi, etc.)

---

## License

Private — BiteSite by CH.
