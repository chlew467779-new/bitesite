# BiteSite

Beautiful Menus for Local Restaurants — Kuala Lumpur, Malaysia.

> **Live URL**: https://bitesite-pied.vercel.app  
> **GitHub**: https://github.com/chlew467779-new/bitesite  
> **Owner**: CH (BiteSite)

---

## 📌 Important — How We Edit Code

**We edit code directly on GitHub.com. No local terminal, no bash commands.**

Every change is done through the GitHub web interface:
1. Go to https://github.com/chlew467779-new/bitesite
2. Click on the file you want to edit
3. Click the **pencil icon** (Edit this file)
4. Paste the new code
5. Scroll down, write a commit message, click **Commit changes**
6. Vercel will auto-deploy within 30–60 seconds

> **Tip**: If you need to create a new file, click **"Add file" → "Create new file"** and type the full path (e.g. `app/our-partner/page.tsx`).

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
| Markdown | react-markdown + remark-gfm |
| Map | Leaflet + OpenStreetMap (free) |
| Charts | Recharts |

---

## Project Structure

```
app/
├── page.tsx                    # Homepage — merchant grid + filters + dish search + Latest Stories
├── layout.tsx                  # Root layout (fonts + metadata + SEO + SiteHeader + Organization Schema)
├── globals.css                 # Tailwind v4 + CSS custom properties
├── sitemap.ts                  # Auto-generated sitemap.xml
├── robots.ts                   # robots.txt
├── loading.tsx                 # Global loading fallback
├── join-us/
│   └── page.tsx                # Join Us pricing page (FAQPage Schema)
├── stories/
│   ├── layout.tsx              # Stories list layout (SEO metadata)
│   ├── page.tsx                # Stories list page (articles grid + category filter)
│   └── [slug]/
│       └── page.tsx            # Story detail page (ISR 300s + Article Schema + Markdown render)
├── our-partner/
│   ├── layout.tsx              # Our Partner page SEO metadata
│   └── page.tsx                # Interactive map showing all merchant locations
├── api/
│   ├── view/
│   │   └── route.ts            # POST /api/view — legacy merchant view count (retained)
│   ├── story-view/
│   │   └── route.ts            # POST /api/story-view — legacy article view count (retained)
│   ├── track/
│   │   └── route.ts            # POST /api/track — universal tracking API (all events, sendBeacon compatible)
│   └── admin/
│       ├── login/
│       │   └── route.ts        # POST /api/admin/login — password auth + 3-strike lockout
│       ├── overview/
│       │   └── route.ts        # GET /api/admin/overview?range=7d — dashboard KPI cards (raw table query)
│       ├── trends/
│       │   └── route.ts        # GET /api/admin/trends?range=7d — trend line chart data
│       ├── merchants/
│       │   └── route.ts        # GET /api/admin/merchants?range=7d — merchant ranking table
│       ├── devices/
│       │   └── route.ts        # GET /api/admin/devices?range=7d — device/OS/browser breakdown (raw table query)
│       ├── locations/
│       │   └── route.ts        # GET /api/admin/locations?range=7d — country + city distribution
│       ├── referrers/
│       │   └── route.ts        # GET /api/admin/referrers?range=7d — traffic source pie chart (raw table query)
│       ├── search-keywords/
│       │   └── route.ts        # GET /api/admin/search-keywords?range=7d — search terms ranking
│       ├── events/
│       │   └── route.ts        # GET /api/admin/events?range=7d — WhatsApp/Booking/Share stats (raw table query)
│       ├── stories/
│       │   └── route.ts        # GET /api/admin/stories?range=7d — Stories views + conversion (raw table query)
│       ├── map/
│       │   └── route.ts        # GET /api/admin/map?range=7d — Map page analytics (raw table query)
│       ├── hourly/
│       │   └── route.ts        # GET /api/admin/hourly?range=7d — 24h peak hours
│       ├── realtime/
│       │   └── route.ts        # GET /api/admin/realtime — current online users (5-min window)
│       └── export/
│           └── route.ts        # GET /api/admin/export?range=7d&format=csv — CSV download
├── store/
│   └── [merchant]/
│       ├── page.tsx              # Merchant detail page (ISR + SSR + Restaurant/Menu/Breadcrumb Schema)
│       └── loading.tsx           # Merchant page skeleton
├── layouts/
│   ├── index.ts                  # Layout registry (classic/elegant/minimal/modern/rustic)
│   ├── classic-layout.tsx        # Warm amber cafe style
│   ├── elegant-layout.tsx        # Dark luxury fine-dining style
│   ├── minimal-layout.tsx        # Clean stone/zen style
│   ├── modern-layout.tsx         # White slate contemporary style
│   └── rustic-layout.tsx         # Orange earthy style
├── admin/                        # Admin Analytics Dashboard (dark theme)
│   ├── page.tsx                  # Admin entry: login form or dashboard shell
│   ├── layout.tsx                # Admin layout (dark mode, no SiteHeader)
│   ├── admin-globals.css         # Admin-specific dark theme styles
│   ├── login-form.tsx            # Password input component
│   └── components/
│       ├── auth-context.tsx      # Login state management (React Context + localStorage)
│       ├── admin-shell.tsx       # Sidebar + main content layout
│       ├── date-range-picker.tsx # Time range selector (today/7d/30d/90d/365d)
│       ├── realtime-badge.tsx    # Live online user counter (30s auto-refresh)
│       ├── stat-cards.tsx        # Top 4 KPI cards (views/unique/events/merchants)
│       ├── trend-chart.tsx       # Traffic trend line chart
│       ├── merchant-table.tsx    # Merchant ranking table (sortable)
│       ├── device-chart.tsx      # Device distribution donut chart
│       ├── location-chart.tsx    # Top cities bar chart
│       ├── referrer-chart.tsx    # Traffic source pie chart
│       ├── search-keywords-table.tsx # Search terms ranking
│       ├── events-chart.tsx      # WhatsApp/Booking/Share stacked bar chart
│       ├── stories-chart.tsx     # Stories views + conversion rate
│       ├── map-stats.tsx         # Map page views + marker clicks
│       ├── hourly-chart.tsx      # 24-hour peak hours bar chart
│       └── export-button.tsx     # CSV export trigger
├── components/
│   ├── map-embed.tsx             # Google Maps iframe embed component
│   └── safe-image.tsx            # Next/Image wrapper with error fallback + loading shimmer
│   └── page-view-tracker.tsx     # Universal page view tracker (Client Component)
└── components/
    ├── ui/
    │   ├── cuisine-tag.tsx           # Pill-shaped cuisine label
    │   └── diamond-separator.tsx     # Decorative divider (◆)
    └── sections/
        ├── hero.tsx                  # Homepage hero with search bar
        ├── category-filter.tsx       # 3-row sticky filter bar with smooth animations
        ├── merchant-card.tsx         # Card: Open Now badge + ShareMenu + ViewCount + tags + hours
        ├── merchant-card-skeleton.tsx # Loading skeleton with pulse animation
        ├── footer.tsx                # Site footer (Home / Stories / Join Us / Our Partner + copyright)
        ├── site-header.tsx           # Global nav bar (Home / Our Partner / Stories / Join Us)
        │
        ├── map-container.tsx         # Map page wrapper: filter + search logic
        ├── map-section.tsx           # Leaflet map: markers with photos, user location pulse, recenter
        ├── map-filter.tsx            # Map top filter pills + search input
        │
        ├── brand-intro.tsx           # Merchant brand intro
        ├── discover-bitesite.tsx     # "Discover more" CTA link to homepage
        ├── info-accordion.tsx        # Location / Hours / Dress Code / Social accordion
        ├── menu-section.tsx          # Category-based menu grid
        ├── product-card.tsx          # Individual dish card with image, price, discount
        ├── related-merchants.tsx     # "You May Also Like" recommendations
        ├── share-menu.tsx            # Floating share menu (auto-close on outside click & scroll)
        ├── share-buttons.tsx         # Inline share buttons (Share + Copy Link only)
        ├── view-tracker.tsx          # Client-side merchant view count tracker (2s delay)
        ├── view-count-inline.tsx     # Eye icon + formatted count badge
        ├── store-hero.tsx            # Full-bleed hero image
        ├── store-footer.tsx          # Merchant footer with WhatsApp CTA
        ├── text-image-block.tsx      # Alternating text/image section
        ├── video-section.tsx         # YouTube embed + self-hosted video player
        │
        ├── join-us-hero.tsx          # Join Us page hero
        ├── how-it-works.tsx          # 3-step process (Shoot → Build → Share)
        ├── pricing-card.tsx          # Pricing card (RM599 + RM149/mo)
        ├── faq-accordion.tsx         # FAQ accordion (6 questions)
        ├── join-us-cta.tsx           # Bottom WhatsApp CTA
        │
        ├── story-filter.tsx          # Stories category filter buttons
        ├── story-card.tsx            # Article card (featured + list variants)
        ├── story-list.tsx            # Article list with featured article on top
        ├── story-hero.tsx            # Story detail hero (title + meta + cover image)
        ├── story-content.tsx         # Markdown renderer for article body (with /store/ link tracking)
        ├── story-related.tsx         # "More Stories" recommendations
        ├── story-view-tracker.tsx    # Client-side article view count tracker
        └── latest-stories.tsx        # Homepage "Latest Stories" section (latest 3 articles)

lib/
├── supabase.ts                 # Supabase client + all DB queries + related merchant scoring + map query
├── hours.ts                    # Timezone-safe open/closed logic (Asia/Kuala_Lumpur)
├── utils.ts                    # cn() — clsx + tailwind-merge
├── styles.ts                   # OLD 3-style theme map (fresh/luxury/japanese) — DEPRECATED
├── map-colors.ts               # Cuisine type → marker color mapping for map
├── image-utils.ts              # Auto image URL optimization (Unsplash / Supabase Storage)
├── whatsapp.ts                 # BiteSite WhatsApp link constant
├── markdown.ts                 # Markdown rendering utilities (reserved)
├── analytics.ts                # EventTypes + classifyReferrer + trackEvent() (sendBeacon priority)
├── device-detect.ts            # User-Agent parser (device / OS / browser) — enhanced with iPad/ChromeOS/Opera
└── admin-auth.ts               # generateAdminToken() + verifyAdminToken() (HMAC-SHA256)

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
| cover_image | TEXT | Hero image URL (used for OG image + map marker photo) |
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
| tags | TEXT[] | Array of tags e.g. `["Halal", "Pet Friendly", "WiFi"]` |
| payment_methods | TEXT[] | `["Cash", "Cashless", "Cards"]` |
| latitude | FLOAT8 | Latitude for map marker |
| longitude | FLOAT8 | Longitude for map marker |
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

### `merchant_stats` (legacy view count — retained for compatibility)
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

### `articles` (blog / stories)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| slug | TEXT | **Required.** URL-friendly identifier. |
| title | TEXT | **Required.** Article headline. |
| excerpt | TEXT | Short summary shown on the list page. |
| content | TEXT | **Required.** Full article body in **Markdown**. |
| cover_image | TEXT | URL to the featured image. **Recommended:** 16:9 ratio. |
| category | TEXT | **Required.** Used for filtering on `/stories`. |
| tags | TEXT[] | Array of tags. |
| merchant_slug | TEXT | **Optional.** Links to a merchant page. |
| author | TEXT | Defaults to `BiteSite Team`. |
| published | BOOLEAN | **Must be `true`** to appear on the website. |
| view_count | INT | Auto-incremented. Do NOT edit manually. |
| created_at | TIMESTAMPTZ | Auto-generated. |
| updated_at | TIMESTAMPTZ | Auto-generated. |

### `page_views` (raw analytics log — primary data source)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| slug | TEXT | Merchant slug (null for non-merchant pages) |
| path | TEXT NOT NULL | e.g. `/store/abc`, `/stories/xyz` |
| page_type | TEXT | merchant / story / home / join_us / our_partner / story_list / other |
| event_type | TEXT NOT NULL DEFAULT 'page_view' | page_view / whatsapp_click / booking_submit / share / search / map_marker_click / story_to_merchant |
| event_detail | TEXT | Search keyword, share platform, etc. |
| ip | TEXT | Visitor IP |
| country | TEXT | From Vercel `x-vercel-ip-country` |
| city | Text | From Vercel `x-vercel-ip-city` |
| device_type | TEXT | mobile / desktop / tablet |
| os | TEXT | iOS / Android / Windows / macOS / Linux / Other |
| browser | TEXT | Chrome / Safari / Samsung Internet / Firefox / Edge / Other |
| user_agent | TEXT | Raw User-Agent string |
| referrer | TEXT | document.referrer |
| referrer_type | TEXT | google / instagram / facebook / whatsapp / direct / internal / other |
| metadata | JSONB DEFAULT '{}' | Reserved for future expansion |
| created_at | TIMESTAMPTZ DEFAULT now() | |

**Indexes**: `created_at`, `slug`, `event_type`, `path`, `device_type`, `country+city`, `page_type`, `referrer_type`

### `merchant_daily_views` (daily aggregated analytics — cron rollup)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| slug | TEXT | null = non-merchant pages |
| page_type | TEXT NOT NULL | |
| view_date | DATE NOT NULL | |
| device_type | TEXT | |
| country | TEXT | |
| city | TEXT | |
| os | TEXT | |
| browser | TEXT | |
| referrer_type | TEXT | |
| event_type | TEXT DEFAULT 'page_view' | |
| count | INT DEFAULT 0 | |
| unique_ips | INT DEFAULT 0 | |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |
| **UNIQUE** | | (slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type) |

**Indexes**: `view_date`, `slug`, `page_type`, `event_type`

### `login_attempts` (brute-force protection)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| ip | TEXT NOT NULL | |
| attempt_count | INT DEFAULT 1 | |
| last_attempt_at | TIMESTAMPTZ DEFAULT now() | |
| locked_until | TIMESTAMPTZ | null = not locked |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| **UNIQUE** | | (ip) |

**Indexes**: `ip`, `locked_until`

---

## 🗺️ How to Add Merchant Coordinates for the Map

The **Our Partner** page (`/our-partner`) displays all merchants on an interactive map. To appear on the map, a merchant **must have** `latitude` and `longitude` values.

### Step 1: Add columns to Supabase (run once)

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_merchants_lat_lng ON merchants(latitude, longitude);
```

### Step 2: Find coordinates for each merchant

1. Open [Google Maps](https://maps.google.com)
2. Search the restaurant address
3. **Right-click** on the exact location on the map
4. Select **"Copy coordinates"** (e.g. `3.1489, 101.7103`)
5. Go to **Supabase → Table Editor → merchants**
6. Paste the first number into `latitude`, the second into `longitude`

> **Merchants without coordinates will NOT appear on the map.** This is intentional — we don't want markers floating in wrong locations.

---

## 📝 How to Publish an Article (Zero Code)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your BiteSite project
3. Navigate to **Table Editor** → `articles`

### Step 2: Click "Insert row"

### Step 3: Fill in the fields

#### Required fields:
| Field | What to enter | Example |
|-------|--------------|---------|
| **slug** | URL-friendly ID, no spaces | `the-hearth-bakery-opening` |
| **title** | Article headline | `The Hearth Bakery Opens in Desa ParkCity` |
| **content** | Full article in **Markdown** | See Markdown syntax below |
| **category** | Filter category | `New Opening` |
| **published** | Set to **true** | ✅ Check the box |

#### Optional but recommended:
| Field | What to enter | Example |
|-------|--------------|---------|
| **excerpt** | 1-2 sentence summary | `After months of anticipation...` |
| **cover_image** | Direct image URL | `https://images.unsplash.com/photo-xxx` |
| **tags** | Array of keywords | `{bakery, desaparkcity, sourdough}` |
| **merchant_slug** | Link to restaurant page | `the-hearth-bakery` |
| **author** | Author name | `BiteSite Team` |

#### Do NOT touch:
- `id` — auto-generated
- `view_count` — auto-incremented
- `created_at` / `updated_at` — auto-generated

### Step 4: Save
Click **Save** → The article immediately appears on:
- `/stories` (list page)
- `/stories/{slug}` (detail page)
- Homepage "Latest Stories" section (if among the 3 newest)

---

## 🖊️ Markdown Syntax for Articles

The `content` field supports full **GitHub Flavored Markdown**:

```markdown
# Main Heading (H1)

## Subheading (H2)

**Bold text** for emphasis.

Regular paragraph text.

- Bullet point 1
- Bullet point 2

1. Numbered item 1
2. Numbered item 2

[Link to merchant page](/store/the-hearth-bakery)

[External link](https://example.com)

![Image description](https://your-image-url.jpg)

> Blockquote: This is a highlighted quote.

| Item | Price |
|------|-------|
| Country Sourdough | RM 18 |

---

Emoji work too! 🍞☕🎉
```

**Important notes:**
- **Images**: Use direct image URLs.
- **Links to merchants**: Use `/store/{merchant-slug}` format.
- **External links**: Use full `https://` URLs. These open in a new tab.

---

## 🔐 Admin Dashboard (/admin)

### Authentication
- **Password**: Stored in Vercel Environment Variable `ADMIN_PASSWORD`
- **Brute-force protection**: 3 failed attempts → lock IP for 15 minutes
- **Session**: HMAC-SHA256 signed token, expires after 30 minutes
- **Token storage**: localStorage (`admin_session`)

### Security Features
| Feature | Implementation |
|---------|---------------|
| Password storage | Vercel Environment Variable (Secret type) |
| Brute-force lockout | `login_attempts` table — 3 strikes = 15 min lock |
| Session token | HMAC-SHA256 signed, tamper-proof |
| Token expiry | 30 minutes |
| API auth | Every admin API checks `x-admin-token` header |

### Current Status (as of 2026-08-28)
| Component | Status | Notes |
|-----------|--------|-------|
| Login & Auth | ✅ Working | Password + brute-force protection |
| Real-time Badge | ✅ Working | Shows online users |
| Traffic Trends | ✅ Working | Daily trend visible |
| Merchant Performance | ✅ Working | Views data showing |
| Location Analytics | ✅ Working | City distribution visible |
| Peak Hours | ✅ Working | 24h peak hours visible |
| **Unique Visitors** | ✅ Fixed | Now queries `DISTINCT ip` from raw `page_views` table |
| **Device Distribution** | ✅ Fixed | Queries raw table; null → `desktop`; enhanced UA parser |
| **Traffic Sources** | ✅ Fixed | Queries raw table; null → `direct`; enhanced referrer classification |
| **Events Analytics** | ✅ Working | All 6 event types tracked and displayed |
| **Stories Analytics** | ✅ Working | Story views + list page views displayed |
| **Map Stats** | ✅ Working | Map page views + marker clicks displayed |
| **Search Keywords** | ✅ Working | Search terms ranked by frequency |
| Chart Tooltips | ✅ Fixed | All Recharts tooltips now have white text on dark background |

### Data Aggregation
- **Raw table**: `page_views` — receives all tracking events via `POST /api/track` (primary, real-time)
- **Aggregated table**: `merchant_daily_views` — hourly rollup via Supabase Cron (`aggregate_daily_views()`)
- **Cron job**: `aggregate-views-hourly` runs every hour at :00
- **Dashboard APIs**: Overview, Devices, Referrers, Events, Stories, Map now query raw `page_views` table for real-time data. Trends, Merchants, Locations, Hourly still use aggregated table for performance.

### Analytics Coverage
| Metric | Source | Status |
|--------|--------|--------|
| Page views | All pages (home, merchant, stories, join-us, our-partner) | ✅ |
| Events | WhatsApp clicks, Booking submits, Shares, Searches, Map marker clicks, Story-to-merchant conversions | ✅ |
| Device | Mobile / Desktop / Tablet + OS + Browser | ✅ |
| Location | Country + City (via Vercel Geo headers) | ✅ |
| Referrer | Google / Instagram / Facebook / WhatsApp / Direct / Internal / Other / Bing / Yahoo / LinkedIn / YouTube | ✅ |
| Real-time | Active users in last 5 minutes | ✅ |
| Export | CSV download per date range | ⏳ Untested |

### Event Tracking (lib/analytics.ts)
```typescript
EventTypes = {
  PAGE_VIEW: 'page_view',
  WHATSAPP_CLICK: 'whatsapp_click',
  BOOKING_SUBMIT: 'booking_submit',
  SHARE: 'share',
  SEARCH: 'search',
  MAP_MARKER_CLICK: 'map_marker_click',
  STORY_TO_MERCHANT: 'story_to_merchant',
}
```

**Tracking reliability**: `trackEvent()` uses `navigator.sendBeacon` as primary transport (browser-guaranteed delivery even on page navigation), with `fetch(keepalive)` as fallback. The `/api/track` endpoint accepts both JSON and Blob bodies.

---

## Supabase RPC Functions

```sql
-- Increment merchant view count (total + monthly)
increment_view_count(merchant_slug TEXT) RETURNS void

-- Increment article view count
increment_article_view(article_slug TEXT) RETURNS void
```

---

## Pages Summary

| Page | Path | Purpose |
|------|------|---------|
| Home | `/` | Browse all restaurants, search (including dishes), filter |
| Merchant | `/store/{slug}` | Individual restaurant menu, map, hours, SEO Schema |
| Our Partner | `/our-partner` | Interactive map showing all merchant locations |
| Stories | `/stories` | Blog list — all articles |
| Story | `/stories/{slug}` | Individual article (Markdown + Article Schema) |
| Join Us | `/join-us` | Pricing & signup for restaurant owners (FAQ Schema) |
| **Admin** | **`/admin`** | **Analytics Dashboard — password protected** |

---

## Our Partner Map Page (`/our-partner`)

### Features
- **Interactive Leaflet map** with OpenStreetMap (completely free)
- **Photo markers**: Each merchant shown as a circular photo with colored border
- **Color-coded by cuisine type**:
  - Cafe = Coffee `#8B4513`
  - Western = Yellow `#F59E0B`
  - Bakery = Orange `#F97316`
  - Japanese / Asian = Red `#EF4444`
  - Dessert = Pink `#EC4899`
  - Other = Gray `#6B7280`
- **User location**: Pulsing green dot with animation
- **Recenter button**: Top-right corner, click to fly back to your location
- **Type filters**: Top bar pills to show/hide cuisine types
- **Search box**: Search by restaurant name, area, or cuisine
- **Empty state**: "No restaurants found" message when filters return nothing
- **Merchant card popup**: Photo, name, Open/Closed badge, cuisine type
- **Two action buttons**:
  - **Go to Merchant Page** → Opens the restaurant's detail page
  - **Get Directions** → Opens Google Maps navigation directly

### How it works
1. Page fetches all published merchants that have `latitude` and `longitude`
2. Map centers on KL by default, or flies to user's GPS location if permission granted
3. Click any marker → bottom card slides up with merchant info
4. Click outside marker or the X button → card closes

---

## 5 Merchant Layouts

Each merchant picks ONE layout via `merchants.layout` column.

| Layout | Vibe | Primary Colors |
|--------|------|----------------|
| **classic** | Warm cafe / bakery | Amber-50 bg, amber-900 text, green accents |
| **elegant** | Dark luxury fine-dining | Slate-950 bg, amber-300/gold accents, white text |
| **minimal** | Clean zen / Japanese | Stone-50 bg, stone-800 text, minimal borders |
| **modern** | Contemporary urban | White bg, slate-900 text, slate-100 accents |
| **rustic** | Earthy / farm-to-table | Orange-50 bg, orange-900 text, warm tones |

All layouts include:
- Google Maps embed in Contact section
- Payment method badges
- Share buttons (Share + Copy Link)
- "Discover more restaurants on BiteSite" footer link

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
  seasonal_popup: boolean; // default false
  events: boolean;         // default false
}
```

---

## View Count & Analytics System

### Legacy System (Retained)
- **Merchant tracking**: `<ViewTracker>` fires `POST /api/view` after 2s delay → `merchant_stats`
- **Article tracking**: `<StoryViewTracker>` fires `POST /api/story-view` after 2s delay → `articles.view_count`

### NEW Universal Tracking System
- **Client function**: `trackEvent()` in `lib/analytics.ts` — uses `navigator.sendBeacon` (guaranteed delivery)
- **API endpoint**: `POST /api/track` → inserts into `page_views` (accepts JSON and Blob bodies)
- **Aggregation**: `merchant_daily_views` table holds daily summaries
- **Cron job**: `aggregate_daily_views()` runs hourly via `pg_cron`
- **Dashboard**: `/admin` displays all metrics in real-time

### Aggregation Setup (One-time)
Run in Supabase SQL Editor:
```sql
CREATE OR REPLACE FUNCTION aggregate_daily_views()
RETURNS void AS $$
BEGIN
  INSERT INTO merchant_daily_views (
    slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type, count, unique_ips
  )
  SELECT 
    slug, page_type, DATE(created_at) as view_date,
    device_type, country, city, os, browser, referrer_type, event_type,
    COUNT(*) as count, COUNT(DISTINCT ip) as unique_ips
  FROM page_views
  WHERE created_at >= CURRENT_DATE - INTERVAL '2 days'
  GROUP BY slug, page_type, DATE(created_at), device_type, country, city, os, browser, referrer_type, event_type
  ON CONFLICT (slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type)
  DO UPDATE SET count = EXCLUDED.count, unique_ips = EXCLUDED.unique_ips, updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('aggregate-views-hourly', '0 * * * *', 'SELECT aggregate_daily_views()');
```

### Tracked Events
| Event | Trigger Location | Status |
|-------|-----------------|--------|
| `page_view` | All pages (via `<PageViewTracker>`) | ✅ Verified |
| `search` | Homepage search box (debounced 1s) | ✅ Verified |
| `whatsapp_click` | Merchant page WhatsApp buttons (all 5 layouts) | ✅ Verified |
| `booking_submit` | Appointment form submission | ✅ Verified |
| `share` | Share buttons (WhatsApp/Facebook/Copy) | ✅ Verified |
| `map_marker_click` | Map page marker clicks | ✅ Verified |
| `story_to_merchant` | Stories article `/store/` links | ✅ Verified |

### Display Locations
- Merchant page Hero: inline eye badge
- Homepage cards: bottom-right eye badge
- Stories list: eye icon + count per article
- Story detail: eye icon + count in hero meta

---

## Image Optimization

All images served through `SafeImage` are automatically optimized via `lib/image-utils.ts`:

- **Unsplash**: Resized to 800px, quality 80, auto WebP format, crop fit
- **Supabase Storage**: Compressed with width/quality parameters
- **Fallback**: Local images and data URIs pass through unchanged

This significantly reduces page load time and mobile data usage without requiring a paid image CDN.

---

## SEO & Performance

### On-Page SEO
- **Meta tags**: Auto-generated per merchant and per article
- **Canonical URLs**: Every page has a canonical link
- **Open Graph**: Title, description, and image for social sharing
- **Twitter Cards**: Summary large image cards

### Structured Data (Schema.org)
- **Organization + WebSite Schema**: Injected on every page via root layout
- **Restaurant Schema**: On every merchant page (`@type: Restaurant`)
- **Menu Schema**: Linked to the menu section (`hasMenu`)
- **BreadcrumbList**: On every merchant page
- **Article Schema**: On every story detail page (datePublished, author, publisher)
- **FAQPage Schema**: On Join Us page (6 questions with accepted answers)

### Technical SEO
- **Sitemap**: Auto-generated from all published merchants (`sitemap.ts`)
- **Robots**: Allow all, sitemap linked (`robots.ts`)
- **Google Search Console**: Verified
- **ISR**: 5-minute revalidation for fresh content without full rebuild
- **Image optimization**: Automatic compression via URL parameters

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Admin Dashboard (server-side only, no NEXT_PUBLIC_ prefix)
ADMIN_PASSWORD=your-secure-password
```

> **Security**: `ADMIN_PASSWORD` must be set in **Vercel Dashboard → Environment Variables** with type **Secret**. Never commit it to Git.

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
9. **Articles are published via Supabase Table Editor** — zero code required
10. **Article images use external URLs** — Google Drive, Unsplash, or any direct image link
11. **Dish search** — homepage search queries all available product names per merchant
12. **Embedded maps** — auto-rendered in Contact section if address exists
13. **Map page requires coordinates** — merchants without `latitude`/`longitude` are hidden from the map
14. **Admin Dashboard is password-only** — no user accounts, no registration
15. **Analytics are self-hosted** — no Google Analytics, all data stays in Supabase
16. **Legacy APIs are preserved** — `api/view` and `api/story-view` continue working alongside new `api/track`

---

## ⚠️ Known Issues (as of 2026-08-28)

### P0: Performance
1. **Vercel deploy time increasing** — Build is getting slower. Likely causes: duplicate files between `components/` and `app/components/`, unused dependencies, or ISR static page generation overhead. Needs investigation.

### P1: Data Accuracy
2. **Stories Conversions shows 0** — `story_to_merchant` events are tracked (verified in `page_views`), but the Dashboard Stories tab shows 0 conversions. Root cause: `story_to_merchant` uses merchant `slug` while story views use article `slug` — mismatch in `app/api/admin/stories/route.ts` matching logic.
3. **Location city names URL-encoded** — `San%20Jose` should display as `San Jose`. Need `decodeURIComponent()` in API or frontend.

### P2: Pending Verification
4. **CSV Export** — Feature implemented but not end-to-end tested.
5. **Stories Conversions rate** — After fixing slug matching, verify conversion rate calculation is correct.

### How to Debug
```sql
-- Check if events are being recorded
SELECT event_type, COUNT(*) FROM page_views GROUP BY event_type;

-- Check recent raw data
SELECT * FROM page_views ORDER BY created_at DESC LIMIT 20;

-- Check aggregated data
SELECT * FROM merchant_daily_views ORDER BY view_date DESC LIMIT 20;

-- Manually trigger aggregation
SELECT aggregate_daily_views();

-- Check cron jobs
SELECT * FROM cron.job;
```

---

## 🗂️ Project History

### Phase 1: Core Platform (Completed)
- Merchant pages with 5 layouts
- Menu system with categories & products
- Stories/blog system
- Our Partner map page
- Join Us pricing page

### Phase 2: Admin Dashboard (Completed 2026-08-27)
- Dark theme analytics dashboard
- Password-protected login
- Real-time online users
- Traffic trends, merchant ranking, device/location/referrer breakdown
- CSV export
- **Data aggregation via Supabase Cron**

### Phase 3: Analytics & Bug Fixes (Completed 2026-08-28)
- ✅ All page view tracking implemented and verified
- ✅ All 7 event tracking types implemented and verified (WhatsApp, Share, Booking, Search, Map, Story)
- ✅ Supabase aggregation cron job deployed and running
- ✅ Unique Visitors calculation fixed (raw table DISTINCT ip)
- ✅ Device Distribution fixed (raw table query + enhanced UA parser)
- ✅ Traffic Sources fixed (raw table query + enhanced referrer classification)
- ✅ Chart tooltips text color fixed (all Recharts components)
- ✅ `trackEvent()` upgraded to `navigator.sendBeacon` for guaranteed delivery
- ✅ Dashboard APIs real-time化 (Overview, Devices, Referrers, Events, Stories, Map)

### Phase 4: Optimization (In Progress)
- ⏳ Investigate and fix Vercel deploy slowness
- ⏳ Fix Stories Conversions slug matching
- ⏳ Fix Location city name URL decoding
- ⏳ Test CSV Export end-to-end
- ⏳ Code cleanup: remove duplicate files, dead code, unused dependencies

---

## 🛠️ Developer Notes

### File Path Trap (Important!)
The project has **two parallel component directories**:
- `components/sections/` — legacy / potentially unused
- `app/components/sections/` — **actively used** (imported by `tier-sections.tsx` via relative path `./appointment-section`)

**Rule**: Before modifying any component, check which directory it's actually imported from. The `app/components/sections/` versions take priority for TierSections and most admin components.

### Analytics Tracking Best Practices
- **For page navigation after tracking**: Use regular `<a>` tags, NOT Next.js `<Link>`. Client-side navigation interrupts `sendBeacon`/`fetch` requests.
- **For WhatsApp/booking opens**: `trackEvent()` is fire-and-forget with `sendBeacon` — no need to `await` before `window.open()`.
- **Testing**: Always verify via Supabase SQL Editor (`SELECT event_type, COUNT(*) FROM page_views GROUP BY event_type`) — don't wait for Dashboard aggregation.

### Supabase Timezone
All `created_at` timestamps are UTC. For Malaysia Time queries, append `+08:00`:
```sql
SELECT * FROM page_views 
WHERE created_at >= '2026-08-28T00:00:00+08:00';
```

---

## License

Private — BiteSite by CH.
