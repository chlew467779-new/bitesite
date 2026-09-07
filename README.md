# BiteSite — KL Restaurant Discovery Platform

> **The most detailed restaurant discovery platform in Kuala Lumpur.** Menu prices, real photos, stories, and everything you need to know before you visit.

**Live:** [https://bitesite-pied.vercel.app](https://bitesite-pied.vercel.app)
**Admin:** [https://bitesite-pied.vercel.app/admin](https://bitesite-pied.vercel.app/admin)
**GitHub:** [github.com/chlew467779-new/bitesite](https://github.com/chlew467779-new/bitesite)

---

## What is BiteSite?

BiteSite is a **restaurant showcase platform** built for Kuala Lumpur's independent cafes, restaurants, and food spots. Unlike Google Maps (which only shows basic info), BiteSite gives diners the full picture — **menu items with prices, real photos, operating hours, payment methods, tags (Halal, Pet Friendly, WiFi, etc.), and food stories**.

### For Diners

- Discover restaurants by cuisine, area, or specific features
- See full menus with prices before visiting
- Check if a place is "Open Now" in real-time
- Read food stories and recommendations
- Book a table directly via WhatsApp

### For Restaurant Owners

- **Free listing** — Submit your restaurant details and get a beautiful page
- **5 unique visual styles** to match your brand (Classic, Elegant, Minimal, Modern, Rustic)
- **Paid promotion** — Get featured on the homepage and rank higher in search (coming soon)
- **Custom styling** — Request a bespoke design for your page (coming soon)

---

## Current Status (September 2026)

| Feature | Status | Notes |
| --- | --- | --- |
| Restaurant listing page | Live | 6 pilot merchants |
| 5 visual layouts | Live | Classic, Elegant, Minimal, Modern, Rustic |
| Stories / Food blog | Live | Multiple articles published |
| Admin Dashboard | Live | 15 tabs, full CRUD |
| Merchant Manager | Live | Search, filter, create, edit, delete |
| Merchant Editor Form | Live | 5 tabs with validation |
| Operating Hours (structured) | Live | 7-day input with multi-slot support |
| Cuisine / Area / Tags dropdowns | Live | Preset + custom input |
| Payment Methods | Live | Cash, Cashless, Cards + custom |
| Dynamic homepage filters | Live | Cuisine & More filters from database |
| Analytics & Tracking | Live | Page views, events, referrer tracking |
| ISR caching (60s) | Live | Fast updates after edits |
| Auto cache revalidation | Live | Admin changes reflect immediately |
| **Merchant self-onboarding** | In planning | Free submission form for restaurant owners |
| **Menu Manager** | In planning | Admin can manage categories & products |
| **File upload (Supabase Storage)** | In planning | Replace URL inputs with direct uploads |
| **Merchant form refactoring** | Next up | Split 1,400-line file into 7 modules |
| **Preview mode** | Planned | Draft preview before publishing |
| **Map coordinate fix** | Planned | Use lat/lng instead of address search |
| **Paid promotion tiers** | Planned | Basic / Premium featured listings |

---

## Business Model Evolution

### Original Model (Deprecated)

- Setup fee: RM599
- Monthly fee: RM149
- **Problem:** In the AI era, anyone can build a website in 5 minutes. Charging for a basic site is no longer viable.

### New Model (Active — September 2026)

**Free Tier:**

- Submit your restaurant details
- Choose from 5 visual styles
- Full menu with prices
- Basic info, hours, contact
- Appear in search & filters

**Paid Promotion (Coming Soon):**

- Featured on homepage
- Higher search ranking
- "Promoted" badge

**Custom Styling (Coming Soon):**

- Bespoke page design
- Custom colors, fonts, layout
- Pricing: RM299-599

**Why this works:**

- **Zero friction** for restaurants to join (free)
- **Network effect:** More restaurants -> More content -> More users -> More restaurants want to join
- **Traffic is the moat:** Not the website builder, but the audience
- **Multiple revenue streams:** Promotion fees, custom design, data insights

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Analytics | Custom event tracking + Supabase |
| Maps | Google Maps Embed |
| Icons | Lucide React |

---

## Project Structure

```javascript
bitesite/
|
├── app/                                    # Next.js App Router
│   ├── page.tsx                            # Homepage (restaurant listing + filters)
│   ├── layout.tsx                          # Root layout
│   ├── globals.css                         # Global styles
│   │
│   ├── store/
│   │   └── [merchant]/
│   │       └── page.tsx                    # Restaurant detail page (ISR 60s)
│   │
│   ├── stories/
│   │   └── [slug]/
│   │       └── page.tsx                    # Story/article detail page (ISR 60s)
│   │
│   ├── join-us/                            # Merchant self-onboarding (planned)
│   │   └── page.tsx
│   │
│   ├── admin/                              # Admin Dashboard
│   │   ├── page.tsx                        # 15-tab dashboard renderer
│   │   ├── layout.tsx                      # force-dynamic (no cache)
│   │   ├── loading.tsx
│   │   └── components/
│   │       ├── admin-shell.tsx             # Tab navigation (13 tabs + settings/export)
│   │       ├── auth-context.tsx            # Admin auth provider
│   │       ├── client-layout.tsx           # Wraps AuthProvider
│   │       ├── merchant-manager.tsx        # Merchant list (cards + search + filters)
│   │       ├── merchant-form.tsx           # Merchant editor (~1,400 lines, 5 tabs)
│   │       ├── stories-manager.tsx         # Stories list
│   │       ├── story-editor.tsx            # Story editor
│   │       ├── stories-chart.tsx           # Stories analytics table
│   │       ├── stat-cards.tsx              # Dashboard overview cards
│   │       ├── trend-chart.tsx             # Views trend chart
│   │       ├── device-chart.tsx            # Device breakdown chart
│   │       ├── referrer-chart.tsx          # Referrer breakdown chart
│   │       ├── events-chart.tsx            # Events chart
│   │       ├── location-chart.tsx          # Location chart
│   │       ├── hourly-chart.tsx            # Hourly traffic chart
│   │       ├── map-stats.tsx               # Map visualization
│   │       ├── search-keywords-table.tsx   # Search keywords table
│   │       ├── merchant-table.tsx          # Merchant analytics table
│   │       ├── export-button.tsx           # CSV export
│   │       ├── realtime-badge.tsx          # Real-time indicator
│   │       ├── date-range-picker.tsx       # Date range selector
│   │       └── settings-panel.tsx          # Settings panel (named export)
│   │
│   ├── api/
│   │   ├── track/
│   │   │   └── route.ts                    # Analytics tracking API (POST)
│   │   └── admin/
│   │       ├── merchants-crud/
│   │       │   └── route.ts                # Merchant CRUD + revalidatePath
│   │       ├── merchants-list/
│   │       │   └── route.ts                # Returns {slug, name} list
│   │       ├── stories/
│   │       │   └── route.ts                # Stories CRUD + revalidatePath
│   │       ├── stories-analytics/
│   │       │   └── route.ts                # Stories analytics data
│   │       └── overview/
│   │           └── route.ts                # Dashboard stats (views, visitors, events)
│   │
│   ├── layouts/                            # 5 restaurant visual themes
│   │   ├── classic-layout.tsx
│   │   ├── elegant-layout.tsx
│   │   ├── minimal-layout.tsx
│   │   ├── modern-layout.tsx
│   │   └── rustic-layout.tsx
│   │
│   └── components/
│       └── sections/
│           ├── tier-sections.tsx           # Gallery, Events, Reviews wrapper
│           ├── gallery-section.tsx         # Photo gallery grid
│           ├── events-section.tsx          # Events list
│           └── ...
│
├── components/                             # LEGACY components (Stories page)
│   └── sections/
│       ├── category-filter.tsx             # Homepage cuisine/more filters
│       ├── hero.tsx                        # Homepage hero section
│       ├── merchant-card.tsx               # Restaurant card component
│       ├── merchant-card-skeleton.tsx      # Loading skeleton
│       ├── footer.tsx                      # Site footer
│       ├── latest-stories.tsx              # Stories section on homepage
│       ├── story-content.tsx               # Story article renderer
│       ├── story-hero.tsx                  # Story hero banner
│       └── ...
│
├── lib/
│   ├── supabase.ts                         # Supabase client
│   ├── analytics.ts                        # trackEvent + classifyReferrer
│   ├── admin-auth.ts                       # verifyAdminToken
│   ├── hours.ts                            # Operating hours parsing/formatting
│   │   ├── DAYS array
│   │   ├── parseOperatingHoursString()
│   │   ├── formatOperatingHoursToString()
│   │   └── formatOperatingHours()
│   ├── presets.ts                          # Constants:
│   │   ├── CUISINE_TYPES (15 presets)
│   │   ├── AREAS (15 KL areas)
│   │   ├── TAGS_PRESETS (12 tags)
│   │   └── PAYMENT_METHODS (Cash/Cashless/Cards)
│   ├── device-detect.ts                    # User-agent device detection
│   └── utils.ts                            # cn() helper
│
├── types/
│   └── index.ts                            # TypeScript type definitions
│
├── public/                                 # Static assets
│   └── ...
│
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

### File Path Traps

**Two parallel `components/sections/` directories exist:**

- `components/sections/` — **Legacy** — Used by Stories page (`story-content.tsx`, `story-hero.tsx`)
- `app/components/sections/` — **New** — Used by restaurant pages

**Always verify import paths before editing!**

---

## Database Schema

### merchants

```sql
id uuid PRIMARY KEY,
slug text UNIQUE NOT NULL,
name text NOT NULL,
tagline text,
description text,
layout text DEFAULT 'classic',
cuisine_type text,
area text,
tags text[],
payment_methods TEXT[] DEFAULT '{}',
address text,
phone text,
whatsapp text NOT NULL,
email text,
website text,
instagram text,
facebook text,
latitude numeric,
longitude numeric,
operating_hours jsonb,
is_published boolean DEFAULT false,
status text DEFAULT 'active',
features jsonb,
logo_image text,
cover_image text,
menu_pdf_url text,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
```

### categories

```sql
id uuid PRIMARY KEY,
merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE,
name text NOT NULL,
sort_order int DEFAULT 0,
created_at timestamptz DEFAULT now()
```

### products

```sql
id uuid PRIMARY KEY,
merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE,
category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
name text NOT NULL,
description text,
price numeric,
discount_price numeric,
image_url text,
sort_order int DEFAULT 0,
is_available boolean DEFAULT true,
is_featured boolean DEFAULT false,
show_prices boolean DEFAULT true,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
```

### articles (Stories)

```sql
id uuid PRIMARY KEY,
slug text UNIQUE NOT NULL,
title text NOT NULL,
excerpt text,
content text,
cover_image text,
category text,
tags text[],
author text,
background_style text,
merchant_slug text,
published boolean DEFAULT false,
view_count int DEFAULT 0,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
```

### page_views (Analytics)

```sql
id uuid PRIMARY KEY,
slug text,
path text,
page_type text,
event_type text,
event_detail text,
referrer text,
referrer_type text,
user_agent text,
ip text,
country text,
city text,
device_type text,
os text,
browser text,
created_at timestamptz DEFAULT now()
```

### merchant_daily_views (Aggregated)

```sql
id uuid PRIMARY KEY,
slug text,
view_date date,
event_type text,
count int DEFAULT 0,
created_at timestamptz DEFAULT now()
```

### merchant_stats (View counts)

```sql
slug text PRIMARY KEY,
view_count int DEFAULT 0,
updated_at timestamptz DEFAULT now()
```

---

## Development Guide

### For Contributors / Future AI Assistants

> **Owner (CH) does not write code.** All technical operations are guided step-by-step via GitHub web editor.

#### Editing Workflow

1. Open [GitHub repository](https://github.com/chlew467779-new/bitesite)
2. Find file -> Click **Edit** (pencil icon)
3. Paste complete code (**first line must be `/* bitesite/file-path */`**)
4. Write clear commit message
5. Wait for Vercel deployment (**30-60 seconds**)
6. Verify on live site before next change

#### Critical Rules

| Rule | Why |
| --- | --- |
| **Max 2-3 files per commit** | Avoid context overflow / forced session end |
| **Test after every commit** | Don't batch untested changes |
| **New files need path comment** | Line 1: `/* bitesite/app/... */` |
| **Verify import paths** | `components/sections/` vs `app/components/sections/` |
| **Check export pattern** | Most use `export default`, only `SettingsPanel` uses named export |
| **Admin token = 30 min** | Refresh page if Unauthorized |
| **ISR cache = 60s** | DB changes reflect within 1 minute |
| **revalidatePath active** | Admin saves immediately update public pages |

#### Export Pattern Reference

| Component | Export | Import |
| --- | --- | --- |
| `AdminShell`, `StatCards`, `MerchantForm`, etc. | `export default` | `import X from '...'` |
| `SettingsPanel` | `export { SettingsPanel }` | `import { SettingsPanel } from '...'` |
| `AuthProvider` | `export { AuthProvider }` | `import { AuthProvider } from '...'` |
| `useAuth` | `export { useAuth }` | `import { useAuth } from '...'` |
| `ClientLayout` | `export { ClientLayout }` | `import { ClientLayout } from '...'` |

---

## Analytics & Known Issues

### Traffic Reality Check

| Metric | Raw Value | Adjusted (Est.) | Note |
| --- | --- | --- | --- |
| Total Page Views | 3.4K | ~500-800 | Includes dev/test traffic |
| Unique Visitors | 8 | ~8 | Real people |
| Daily Traffic | — | 2-5 visitors | 6 merchants, zero marketing |

**Data Quality Issues:**

- **Dev IP:** `161.142.139.x` — CH's test traffic (normal, not bots)
- **AWS Crawlers:** `54.183.x.x`, `13.57.x.x` — Monitoring/spider traffic
- **Cleanup SQL:**

```sql
  DELETE FROM page_views WHERE ip LIKE '161.142.139.%';
  DELETE FROM page_views WHERE ip IN ('54.183.149.156', '13.57.148.235');
  DELETE FROM page_views WHERE user_agent ILIKE '%bot%' OR user_agent ILIKE '%crawler%';
```

### Known Issues

| Issue | Priority | Status | Files |
| --- | --- | --- | --- |
| Merchant form is 1,400+ lines | High | **Next task** | `merchant-form.tsx` -> split into 7 files |
| No merchant self-onboarding | High | Planned | `app/join-us/page.tsx` (new) |
| No file upload (URL only) | High | Planned | Supabase Storage |
| Map uses address not lat/lng | Medium | Planned | `map-embed.tsx` + 5 layouts |
| No preview mode | Medium | Planned | `store/[merchant]/page.tsx` |
| Robot data pollution | Low | Identified | `track/route.ts` + cleanup SQL |
| No auto-save | Low | Planned | localStorage draft |
| No duplicate merchant | Low | Planned | Admin feature |

---

## Roadmap

### Phase 1: Foundation (Completed)

- Homepage, restaurant pages, stories system
- 5 visual layouts (Classic, Elegant, Minimal, Modern, Rustic)
- Supabase + Vercel deployment
- Analytics tracking system

### Phase 2: Admin Dashboard (Completed)

- 15-tab admin interface
- Full CRUD for merchants & stories
- Merchant Manager with search/filter
- Merchant Editor with 5 tabs

### Phase 3: Content & UX (Completed)

- Structured operating hours (7-day multi-slot input)
- Dynamic homepage filters (Cuisine & More from database)
- Cuisine/Area/Tags dropdowns with custom input
- Payment Methods (Cash/Cashless/Cards + custom)
- "Other" cuisine grouping for non-preset types
- Empty section auto-hide across all 5 layouts
- Image URL validation + preview
- Social link validation
- Toast notifications
- ISR reduced to 60s + auto revalidation

### Phase 4: Refactoring (Next)

**Split `merchant-form.tsx` into 7 modules:**

```javascript
app/admin/components/
├── merchant-form.tsx              <- Main shell (~200 lines)
├── merchant-form-shared.tsx       <- Shared helpers & types
├── merchant-form-basic-tab.tsx    <- Basic Info tab
├── merchant-form-contact-tab.tsx  <- Contact tab
├── merchant-form-hours-tab.tsx    <- Hours tab
├── merchant-form-settings-tab.tsx <- Settings tab
└── merchant-form-images-tab.tsx   <- Images tab
```

**Execution:** 1 file per commit, test after each.

### Phase 5: Self-Onboarding (Planned)

- `/join-us` public submission form (no login required)
- 6 tabs: Basic Info, Contact, Hours, Images, Menu, Settings
- File upload via Supabase Storage (logo, cover, gallery, documents)
- Admin "Pending Review" queue
- Approve/Reject with WhatsApp notifications
- Status flow: `submitted` -> `pending_review` -> `approved`/`rejected`

### Phase 6: Menu Manager (Planned)

- Admin UI for categories + products per merchant
- CRUD API: `app/api/admin/products/route.ts`
- Drag-and-drop sorting
- Frontend menu rendering integration

### Phase 7: Monetization (Planned)

- Paid promotion tiers (Basic / Premium)
- Featured listings on homepage
- Search ranking boost
- Custom styling packages (RM299-599)

### Phase 8: Scale (Future)

- Multi-branch support (one brand, multiple locations)
- User reviews & ratings
- Multi-language (EN / BM / Chinese)
- Mobile PWA
- Restaurant owner analytics dashboard
- Auto-save drafts
- Duplicate merchant feature

---

## How to List Your Restaurant

### Option 1: Contact Us (Available Now)

Reach out via WhatsApp with your restaurant details and we'll set up your page.

### Option 2: Self-Service (Coming Soon)

1. Go to **bitesite.my/join-us**
2. Fill in your restaurant details (6 simple steps)
3. Upload your logo, cover photo, and menu
4. Submit for review
5. Get approved and go live within **1-2 business days**

**It's free.** No setup fee. No monthly fee. Just great exposure for your restaurant.

---

## Contact & Links

- **Website:** [bitesite-pied.vercel.app](https://bitesite-pied.vercel.app)
- **GitHub:** [github.com/chlew467779-new/bitesite](https://github.com/chlew467779-new/bitesite)
- **Location:** Kuala Lumpur, Malaysia
- **Focus:** Independent cafes, restaurants, and food spots in KL

---

## Changelog

### 2026-09-06

- Dynamic homepage filters (Cuisine & More from database)
- "Other" cuisine grouping for non-preset types
- Payment Methods filtering in "More" section
- Business model pivot: Free onboarding + paid promotion

### 2026-08-31

- Phase 4: Merchant Manager & Editor complete
- Structured operating hours (7-day multi-slot input)
- Cuisine/Area/Tags dropdowns with custom input
- Payment Methods (Cash/Cashless/Cards + custom)
- Image URL validation + preview
- Social link validation
- Toast notifications
- ISR reduced to 60s + auto revalidation

### 2026-08-30

- Phase 3: Stories Analytics optimization
- Phase 2: Admin Dashboard 14 tabs fixed

### Earlier

- Phase 0-1: Foundation, layouts, deployment

---

## Key Instructions for New AI Assistants (Must Follow)

> **CH does not code.** All technical operations must be:
> 1. **Provide complete code** for copy-paste to GitHub
> 2. **Step by step**, max 2-3 files per commit
> 3. **Wait for Vercel deploy** (30-60s), verify before next step
> 4. **Every new file line 1 must have comment**: `/* bitesite/file-path */`
> 5. **File path trap**: `components/sections/` and `app/components/sections/` may have same-name files
> 6. **ISR cache is 60s**: DB changes visible within 1 minute
> 7. **Save/delete auto-refreshes cache**: revalidatePath is connected
> 8. **Import export trap**: admin components mostly `export default`, only `SettingsPanel` is named export `{ SettingsPanel }`
> 9. **Work in stages**: Don't plan too many file changes per conversation
> 10. **Token expires in 30 min**: Admin Unauthorized -> refresh page
> 11. **Test after every change**: Don't give too many files for CH to test alone
> 12. **Big file split**: `merchant-form.tsx` is 1,400+ lines, must split (see Roadmap Phase 4)
> 13. **CH's IP is 161.142.139.x**: Dev/test traffic, not robots

---

## Project Context (Quick Background)

- **Business:** Restaurant showcase platform for KL independent cafes/restaurants, no shopping cart
- **Tech Stack:** Next.js 16 + Tailwind v4 + Supabase + Vercel
- **Key Decisions:**
- No cart / no checkout / no auth (user side)
- Each merchant page has independent visual style (classic/elegant/minimal/modern/rustic)
- BiteSite brand only shown subtly in footer link
- Booking form sends to merchant's own WhatsApp (`merchant.whatsapp`)
- **Pricing:** Original Setup RM599 + Monthly RM149 -> **Transitioning to free onboarding + paid promotion**

---

## Completed Work Summary (As of 2026-09-06)

### Phase 0-1: Foundation (Previously completed)

- Homepage, merchant list, merchant detail pages, Stories pages
- 5 layout styles (classic/elegant/minimal/modern/rustic)
- Supabase database + Vercel deployment
- Analytics tracking system

### Phase 2: Admin Dashboard Fix (2026-08-31 completed)

- 14 tabs all rendering correctly
- `dynamic = 'force-dynamic'` moved to layout.tsx

### Phase 3: Stories Analytics Optimization (2026-08-31 completed)

- Stories Analytics table shows real titles (not slug)
- Dual views system (Period Views + Total Views)
- Status column (Published/Draft)
- event_detail fallback fix

### Phase 4 Step 1: Merchant Manager List (2026-08-31 completed)

**Files:**

- `app/api/admin/merchants-crud/route.ts` — GET endpoint, returns enriched merchants (with product_count, view_count)
- `app/admin/components/merchant-manager.tsx` — Card-based list with search, Published/Draft filter, Status filter
- `app/admin/components/admin-shell.tsx` — Added "Merchant Manager" tab
- `app/admin/page.tsx` — Added `merchant-manager` tab rendering

**Features:**

- Display merchant logo, name, slug, layout, is_published status, views count, products count
- Search box: search by name/slug
- Status filter: All / Published / Draft
- Status filter: All / Active / Inactive (top-right dual labels: Live/Draft + Active/Inactive)
- New merchant button
- Click card to enter edit
- View external link opens merchant page

### Phase 4 Step 2: Merchant Editor Form (2026-08-31 completed)

**Files:**

- `app/api/admin/merchants-crud/route.ts` — Updated, supports POST/PUT/DELETE + revalidatePath
- `app/admin/components/merchant-form.tsx` — New, complete form with 5 tabs
- `app/admin/components/merchant-manager.tsx` — Updated, integrated form (create/edit/delete)

**5 Tabs:**

1. **Basic Info:** name*, slug* (auto-generated), tagline, description, layout (5 options), cuisine_type (dropdown+custom), area (dropdown+custom), tags (multi-select pills+custom), payment_methods (multi-select pills+custom)
2. **Contact:** address, phone, whatsapp*, email, website, instagram, facebook, latitude, longitude
3. **Hours:** Structured input (multi time slots per day + Closed toggle + Copy Monday to all)
4. **Settings:** is_published toggle, status (active/inactive), 9 Features checkboxes
5. **Images:** logo_image URL, cover_image URL, menu_pdf_url URL (with preview)

**Form Validation:**

- name required
- slug required, unique, only a-z0-9- (auto-generated from name)
- whatsapp required (Booking form needs it)

**Delete Feature:**

- Click Delete shows confirmation dialog
- Before delete auto-cleans related data (products, categories, merchant_videos, events)

### Performance Optimization (2026-08-31 completed)

- ISR cache reduced from 300s to 60s (`app/store/[merchant]/page.tsx` and `app/stories/[slug]/page.tsx`)
- Admin API save/delete immediately calls `revalidatePath()`
- Merchants: POST/PUT/DELETE refreshes `/store/{slug}` and `/`
- Stories: POST/PUT/DELETE refreshes `/stories/{slug}` and `/stories`

### Round 1 Batch 1: Empty Module Auto-Hide — TierSections (2026-08-31 completed)

**Files:**

- `app/components/sections/tier-sections.tsx` — Added content check before calling Gallery/Events/Reviews
- `app/components/sections/gallery-section.tsx` — Returns null when empty
- `app/components/sections/events-section.tsx` — Returns null when empty

### Round 1 Batch 2: 5 Layout Empty Module Hide + Hero Fallback (2026-08-31 completed)

**Files:**

- `app/layouts/modern-layout.tsx` — Hero fallback (first letter capitalized) + Menu hide
- `app/layouts/classic-layout.tsx` — Hero fallback + Menu hide (already correct, confirmed)
- `app/layouts/elegant-layout.tsx` — Hero fallback + Menu hide
- `app/layouts/minimal-layout.tsx` — Hero fallback + Menu hide
- `app/layouts/rustic-layout.tsx` — Hero fallback + Menu hide

### A3: Image URL Validation + Social Links Validation + Toast (2026-08-31 completed)

**File:** `app/admin/components/merchant-form.tsx`

**Features:**

- Image URL input: if not ending with .jpg/.jpeg/.png/.webp/.gif/.svg/.bmp, show yellow warning
- PDF URL input: if not ending with .pdf, show yellow warning
- Website/Instagram/Facebook: if not starting with http:// or https://, show yellow warning
- Preview image load failure shows "Failed to load" clear message (not silently hidden)
- Toast system: Save success green, Delete success green, error red (3s auto-dismiss)

### A2: Operating Hours Structured Input + Frontend Standardization (2026-08-31 completed)

**Files:**

- `lib/hours.ts` — New `DAYS` array, `parseOperatingHoursString()`, `formatOperatingHoursToString()`, `formatOperatingHours()`
- `app/admin/components/merchant-form.tsx` — Hours tab refactored to structured cards
- `app/layouts/classic-layout.tsx` — Connected `formatOperatingHours()` + `DAYS` fixed order
- `app/layouts/elegant-layout.tsx` — Same
- `app/layouts/minimal-layout.tsx` — Same
- `app/layouts/modern-layout.tsx` — Same
- `app/layouts/rustic-layout.tsx` — Same

**Admin Hours Form Features:**

- One card per day, showing day name + "Set as Closed" button
- Default one Start Time / End Time input pair
- "+ Add time slot" button to add multiple time slots
- Each row has delete button (X), hidden when only one row remains
- "Copy Monday to all" shortcut button
- Closed state shows "Closed" text, no input fields
- Save auto-formats to string stored in database (e.g. "9:00 AM - 10:00 PM, 3:00 PM - 7:00 PM")

**Frontend Display Standardization:**

- `formatOperatingHours()`统一 AM/PM uppercase (am->AM, pm->PM, a.m.->AM)
- Recognizes "Closed" (case-insensitive) -> displays "Closed"
- Deduplicates duplicate time slots
- Filters invalid content (e.g. "asd - asd" won't display as time, returns original string)
- All 5 layouts' Hours lists use `DAYS` array fixed order: Monday->Sunday

### C1: Cuisine/Area/Tags Dropdown + Custom (2026-08-31 completed)

**Files:**

- `lib/presets.ts` — New, stores CUISINE_TYPES / AREAS / TAGS_PRESETS
- `app/admin/components/merchant-form.tsx` — Basic Info tab refactored

**Features:**

- Cuisine Type: 15 preset dropdown + "Other" custom input
- Area: 15 KL area dropdown + "Other" custom input
- Tags: 12 preset multi-select pills + custom input (Enter or + button to add)

### Payment Methods (2026-08-31 19:06 completed)

**Files:**

- `lib/presets.ts` — Added `PAYMENT_METHODS = ["Cash", "Cashless", "Cards"]`
- `app/admin/components/merchant-form.tsx` — Added Payment Methods section at bottom of Basic Info tab
- `app/api/admin/merchants-crud/route.ts` — POST/PUT supports `payment_methods` field

**Database:**

- `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT '{}';` — Executed

**Admin Form Features:**

- Cash / Cashless / Cards three preset pills (green, different from Tags' amber color)
- Custom input box (Enter or + button to add)
- Selected tags displayed below, clickable X to remove
- Saved to database `payment_methods` field (TEXT[] array)

**Frontend Display:**

- Merchant detail page correctly displays Payment Methods (screenshot verified)
- Custom payment method (e.g. "ABCD") can also be saved and displayed

### Stage C: Homepage Filter Dynamic Read (2026-09-06 completed)

**Files:**

- `components/sections/category-filter.tsx` — Removed hardcoded CUISINE_TAGS / MORE_TAGS, changed to receive props
- `app/page.tsx` — Dynamically extracts cuisine_type, tags, payment_methods, passes to filter

**Features:**

- Cuisine row: dynamically extracted from all published merchants' `cuisine_type`
- In `CUISINE_TYPES` preset list -> displayed normally
- Not in preset list -> grouped as "Other" button
- Click "Other" shows merchants whose cuisine_type is not in preset list
- More row: dynamically extracted union from all published merchants' `tags` + `payment_methods`
- No longer hardcoded Halal/Cash/Cashless/Cards
- Displays whatever is in database
- Filter logic `matchesCuisine`: supports "Other" filter
- Filter logic `matchesMore`: matches both `tags` and `payment_methods`

---

## Known Issues Summary (Updated Status)

### High Priority (Affecting existing merchant experience)

#### Issue 1: Operating Hours Input Not Standardized (Fixed)

**Status:** Done. Admin form is structured, frontend display is standardized.
**Remaining:** If database still has old format messy data (e.g. "9:00 am - 10:00 pm 9:00 am - 10:00 pm"), frontend `formatOperatingHours()` will try to clean, but recommend CH checks each merchant and re-saves Hours.

#### Issue 2: Empty Module Display Title (Fixed)

**Status:** All 5 layouts completed.

#### Issue 3: Image URL Easy to Fill Wrong (Fixed)

**Status:** Admin form added yellow warning + help text + preview failure message.

#### Issue 4: Social Links No Format Validation (Fixed)

**Status:** Admin form added `https://` placeholder + yellow warning.
**Remaining:** If URL is invalid during frontend rendering, may still show as clickable link causing 404. Recommend adding `isValidHttpUrl()` check on frontend later.

#### Issue 5: Missing Save Success/Failure Feedback (Fixed)

**Status:** Toast system connected to merchant-form.tsx.

### Medium Priority (Admin feature improvement)

#### Issue 6: Features Toggle Has 9 Options But Most Lack Content Management

**Current Status:**

| Feature | Has Content Management | Where Content Exists |
| --- | --- | --- |
| Hero | Yes | Images tab -> cover_image |
| About | Yes | Basic Info -> description |
| Menu | No | Needs Menu Manager |
| Contact | Yes | Contact tab |
| Related | Yes | Automatic (same cuisine_type) |
| Events | No | Needs Events Editor |
| Video | No | Needs Video URL input |
| Gallery | No | Needs Gallery image management |
| Testimonials | No | Needs Reviews management |

**Need:**

- Short term: Features without content management don't show toggle, or toggle labeled "Coming soon"
- Or: toggle exists but corresponding block auto-hides when empty (partially done)

**Status:** Partially done (empty modules hidden, but Admin toggle still visible)

#### Issue 7: Cuisine Type / Area / Tags Dropdown+Custom (Fixed)

**Status:** Admin form completed.
**Remaining:** Homepage filter bar changed to dynamic read (Stage C completed).

#### Issue 8: Missing Preview Function (Not started)

**Need:**

- Form adds "Preview" button, opens `/store/{slug}?preview=1` in new tab
- For Draft status merchants, can also preview (bypass is_published check)

**Involved Files:**

- `app/admin/components/merchant-form.tsx` — Add Preview button
- `app/store/[merchant]/page.tsx` — Needs to support `?preview=1` parameter

**Status:** Not started (recommend doing next round)

#### Issue 12: Map Coordinate Accuracy (Not started)

**Phenomenon:** Filled Latitude 3.134, Longitude 101.7, but map shows Kuchai Lama (may be default coordinates)
**Root Cause:** `app/components/map-embed.tsx` only uses `address` string search, **completely doesn't use latitude/longitude**

**Decision:** Switch to Google Maps Embed iframe, prioritize coordinates (lat,lng), fallback to address search when coordinates empty

**Involved Files:**

- `app/components/map-embed.tsx` — Change to prioritize lat/lng
- `app/layouts/*` — Pass lat/lng to MapEmbed

**Status:** Not started

#### Issue 13: Robot Data Pollution in Analytics (Pending)

**Phenomenon:** Total Views 3.4K, Unique Visitors 8, ratio 425:1 extremely abnormal
**Root Cause:**

- CH development testing frequently refreshes pages (IP 161.142.139.x range)
- AWS server crawlers (54.183.149.156, 13.57.148.235)

**SQL Cleanup Commands** (run in Supabase SQL Editor):

```sql
-- Delete CH development test data
DELETE FROM page_views WHERE ip LIKE '161.142.139.%';
-- Delete AWS robots
DELETE FROM page_views WHERE ip IN ('54.183.149.156', '13.57.148.235');
-- Delete all bots
DELETE FROM page_views
WHERE user_agent ILIKE '%bot%'
   OR user_agent ILIKE '%crawler%'
   OR user_agent ILIKE '%headless%'
   OR user_agent ILIKE '%python%'
   OR user_agent ILIKE '%java%';
```

**Long-term Fix:** Add robot filtering in `lib/analytics.ts` and `app/api/track/route.ts` (code discussed, not implemented)

**Status:** Pending (doesn't affect functionality, only data accuracy)

### Low Priority (Experience improvement)

#### Issue 9: Missing Auto-save

**Need:** Fill halfway, refresh page, content not lost (localStorage draft)
**Status:** Not started

#### Issue 10: Missing Duplicate Merchant Feature

**Need:** Copy based on existing merchant, change name to quickly create new merchant
**Status:** Not started

#### Issue 11: tagline Field Database Compatibility

**History:** When initially creating merchants table, tagline field may not have existed
**SQL Check:** `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tagline TEXT;`
**Status:** Confirmed (merchant-form save doesn't error on tagline, field exists)

---

## Next Steps (By Phase)

### CH's Decision: Do Stage B (split merchant-form.tsx) first, then discuss website development

> CH explicitly stated: finish Stage B (split large file) first, then discuss merchant self-onboarding and other new features.
> Stage C completed, Stage B is next priority.

---

### Stage B: Split Large File (Refactoring) — High Priority, Starting Soon

**Goal:** Split `merchant-form.tsx` (1,400+ lines) into multiple small files to avoid code truncation risk

**Split Plan** (7 files):

```javascript
app/admin/components/
├── merchant-form.tsx              <- Main shell (~200 lines): Header, Tab nav, Actions, Delete Modal, Toast
│   └── Imports 5 tab components + shared
├── merchant-form-shared.tsx       <- Shared (~120 lines): Toast component, URL validation helpers, generateSlug, type definitions
├── merchant-form-basic-tab.tsx    <- Basic Info (~350 lines): Name/Slug/Tagline/Description/Layout/Cuisine/Area/Tags/Payment
├── merchant-form-contact-tab.tsx  <- Contact (~180 lines): Address/Phone/WhatsApp/Email/Website/Social/Coordinates
├── merchant-form-hours-tab.tsx    <- Hours (~250 lines): 7-day structured time input + Copy Monday
├── merchant-form-settings-tab.tsx <- Settings (~150 lines): Published toggle, Status, Features 9 checkboxes
└── merchant-form-images-tab.tsx   <- Images (~150 lines): Logo/Cover/Menu PDF + preview + URL warnings
```

**Split Execution Order (Recommended):**
**Round 1:** Create `merchant-form-shared.tsx` (shared components and helpers)
**Round 2:** Create `merchant-form-basic-tab.tsx`
**Round 3:** Create `merchant-form-contact-tab.tsx`
**Round 4:** Create `merchant-form-hours-tab.tsx`
**Round 5:** Create `merchant-form-settings-tab.tsx`
**Round 6:** Create `merchant-form-images-tab.tsx`
**Round 7:** Rewrite `merchant-form.tsx` main shell, import all child components

**Only change 1-2 files per round, test Admin form after commit.**

**Note:** No new features during split, only refactoring. CH confirmed to do Stage B first.

---

### Stage D: Menu Manager (Core Feature) — Not Started

**Goal:** Can manage menus in Admin (Categories + Products)

**D1: Menu Manager UI**

- New `app/admin/components/menu-manager.tsx`
- Embed in MerchantForm or as independent tab
- Feature: Display merchant's categories + products, CRUD, drag-and-drop sorting

**D2: Menu CRUD API**

- New `app/api/admin/products/route.ts` (GET/POST/PUT/DELETE)
- Operate on categories and products tables

**D3: Frontend Menu Rendering Integration**

- Confirm how merchant page reads categories/products
- Workload: Large

**Status:** Not started (recommend starting after Stage B completed)

---

### Stage E: Other Content Management (Events/Video/Gallery/Testimonials)

- Need new database tables
- Each needs independent Admin management interface
- Workload: Large, split into multiple stages

**Status:** Not started

---

### Stage F: Phase 5 Optimization

- Supabase Storage image upload (replace URL input)
- Auto-save
- Duplicate Merchant
- Preview function
- Map coordinate fix (map-embed.tsx uses lat/lng)
- Stories pagination, full-text search

**Status:** Not started

---

## Business Model Change Plan (Merchant Self-Onboarding)

> **CH decided to transform:** From "charge merchants to build website" to "free onboarding + paid promotion"
> Detailed discussion happened 2026-09-06, below is confirmed plan.

### 5.1 New Business Model

| Service | Price | Content |
| --- | --- | --- |
| **Free Onboarding** | RM0 | Basic page (5 styles) + menu display + basic info |
| **Paid Promotion** | TBD | Search ranking boost, homepage Featured, "Promoted" badge |
| **Custom Style** | RM299-599 | Exclusive colors, fonts, layout adjustments |

### 5.2 Merchant Self-Onboarding Flow (MVP Version)

```javascript
Merchant visits /join-us
    |
Fill onboarding form (6 tabs)
    |
Submit -> status = pending_review
    |
CH reviews in Admin backend
    |- Approve -> is_published = true, auto goes live
    |- Reject -> WhatsApp notification with reason
```

### 5.3 Information Collected in Onboarding Form

**Required:**

- Restaurant name (min 2 chars)
- Slug (auto-generated from name, editable, unique)
- Cuisine Type (dropdown 15 presets + Other custom)
- Area (dropdown 15 KL areas + Other custom)
- Full address (min 10 chars)
- WhatsApp number (Malaysia format)
- Operating Hours (7-day structured input)
- Cover Image (mandatory upload)
- Style selection (Classic/Elegant/Minimal/Modern/Rustic)

**Optional:**

- Tagline (within 30 chars)
- Description (100-300 chars)
- Phone (can differ from WhatsApp)
- Email (format validation)
- Website / Instagram / Facebook (URL validation)
- Tags (multi-select: Halal, Pet Friendly, WiFi, etc.)
- Payment Methods (multi-select: Cash, Cashless, Cards)
- Latitude / Longitude (map precise positioning)
- Logo Image (recommended upload, fallback to first letter if missing)
- Menu PDF (optional)
- Gallery images (optional, max 10)

**Documents (soft requirement, not mandatory):**

- SSM registration certificate (proves legal operation)
- Business license
- Halal certificate (if checked Halal tag)
- Stored in Supabase Storage

### 5.4 Merchants Don't Need Login

- Onboarding form submitted directly, no registration/login needed
- After approval, merchant contacts CH via WhatsApp to modify info
- CH manually modifies in Admin backend
- Long-term plan: Send merchant "edit link" (with unique token, 30-day validity)

### 5.5 Image Handling Plan

| Image Type | Solution | Note |
| --- | --- | --- |
| Cover (mandatory) | Supabase Storage file upload | Most important visual on page |
| Logo (recommended) | Supabase Storage file upload | Fallback to first letter if missing |
| Gallery (optional) | Supabase Storage file upload | Max 10 images |
| Documents | Supabase Storage file upload | Sensitive files |
| Temporary missing | Pick one from Unsplash as temp | When merchant has no photos yet |

**Unsplash Link solution NOT recommended** (discussed and rejected):

- Links expire
- Not real photos
- Poor merchant experience (needs to register Unsplash -> upload -> copy link)
- Too long process, high drop-off rate

### 5.6 Anti-Duplicate/Spam Mechanism

**Auto-check (on submit):**

- Same WhatsApp number can only submit once within 24 hours
- Same Slug exists -> auto append `-2` or reject
- Same address exists -> prompt "This address already has a restaurant, update or new branch?"

**Manual check (CH backend):**

- Has documents -> quick approval
- No documents -> Google search to confirm restaurant exists

### 5.7 Review Status Flow

```javascript
[submitted] -> Merchant just submitted
    |
[pending_documents] -> Waiting for document review (if needed)
    | CH clicks Approve
[pending_review] -> Waiting for content review
    | CH clicks Approve
[approved] -> Live, is_published = true
    |
[rejected] -> CH clicks Reject, fills reason, WhatsApp notification
```

### 5.8 Review Notification (WhatsApp)

**When Approved:**

> "Hi [Merchant Name], your BiteSite page has been approved! Page is live: https://bitesite.my/store/xxx To modify info, please reply to this message."

**When Rejected:**

> "Hi [Merchant Name], thank you for submitting. Currently not approved, reason: [your reason]. Please modify and resubmit, or contact us for assistance."

### 5.9 Involved New Files (To Create)

| File | Description | Priority |
| --- | --- | --- |
| `app/join-us/page.tsx` | Merchant self-submission page | High |
| `app/api/join/route.ts` | No-login submission API | High |
| `app/admin/components/pending-review.tsx` | Admin review list | High |
| `app/api/admin/merchants-crud/route.ts` | Exists, needs review status support | Medium |

---

## Database Schema Quick Reference (Latest Confirmed)

### merchants

```sql
id uuid, slug text UNIQUE, name text, tagline text, description text,
layout text, cuisine_type text, area text, tags text[], payment_methods TEXT[] DEFAULT '{}',
address text, phone text, whatsapp text, email text, website text,
instagram text, facebook text, latitude numeric, longitude numeric,
operating_hours jsonb, is_published boolean DEFAULT false,
status text DEFAULT 'active', features jsonb,
logo_image text, cover_image text, menu_pdf_url text,
created_at timestamptz, updated_at timestamptz
```

### categories

```sql
id uuid, merchant_id uuid REFERENCES merchants(id),
name text, sort_order int, created_at
```

### products

```sql
id uuid, merchant_id uuid REFERENCES merchants(id),
category_id uuid REFERENCES categories(id), name text,
description text, price numeric, discount_price numeric, image_url text,
sort_order int, is_available boolean DEFAULT true, is_featured boolean DEFAULT false,
show_prices boolean DEFAULT true, created_at, updated_at
```

### articles (Stories)

```sql
id uuid, slug text UNIQUE, title text, excerpt text, content text,
cover_image text, category text, tags text[], author text,
background_style text, merchant_slug text, published boolean,
view_count int DEFAULT 0, created_at, updated_at
```

### page_views (Analytics)

```sql
id uuid, slug text, path text, page_type text, event_type text,
event_detail text, referrer text, user_agent text, ip text, created_at
```

**Note:** `payment_methods` field already added:

```sql
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT '{}';
```

---

## Key File Status Quick Reference

### Currently Confirmed Normal Files

| File | Status | Note |
| --- | --- | --- |
| `package.json` | Normal | Added remark-breaks |
| `app/api/admin/stories/route.ts` | Normal | Includes revalidatePath |
| `app/api/admin/merchants-crud/route.ts` | Fixed | Full CRUD + revalidate + payment_methods |
| `app/api/admin/merchants-list/route.ts` | Normal | Returns {slug, name} |
| `app/api/admin/stories-analytics/route.ts` | Normal | Includes title/published/fallback |
| `components/sections/story-content.tsx` | Normal | remark-breaks + line break handling |
| `app/admin/components/story-editor.tsx` | Normal | Complete rewrite, full features |
| `app/admin/components/stories-manager.tsx` | Normal | updated_at + tags null fix |
| `app/admin/components/stories-chart.tsx` | Normal | Includes Status column |
| `app/admin/components/auth-context.tsx` | Normal | Unchanged |
| `app/admin/components/admin-shell.tsx` | Normal | 13 tabs + settings/export |
| `app/admin/components/client-layout.tsx` | Normal | Wraps AuthProvider |
| `app/admin/components/merchant-manager.tsx` | Normal | Includes Status filter + form integration |
| `app/admin/components/merchant-form.tsx` | Fixed | 5 tabs + Toast + URL validation + structured Hours + Cuisine/Area/Tags dropdown + Payment Methods |
| `app/admin/layout.tsx` | Normal | force-dynamic |
| `app/admin/page.tsx` | Normal | 15 tabs all rendering |
| `lib/analytics.ts` | Normal | trackEvent + classifyReferrer |
| `lib/admin-auth.ts` | Normal | verifyAdminToken |
| `lib/supabase.ts` | Normal | Unchanged |
| `lib/hours.ts` | Fixed | Added DAYS + structured parsing + formatOperatingHours |
| `lib/presets.ts` | Fixed | Added CUISINE_TYPES + AREAS + TAGS_PRESETS + PAYMENT_METHODS |
| `app/components/sections/tier-sections.tsx` | Fixed | Empty module check |
| `app/components/sections/gallery-section.tsx` | Fixed | return null when empty |
| `app/components/sections/events-section.tsx` | Fixed | return null when empty |
| `app/layouts/modern-layout.tsx` | Fixed | Hero fallback + Menu hide + Hours standardization |
| `app/layouts/classic-layout.tsx` | Fixed | Hero fallback + Menu hide + Hours standardization |
| `app/layouts/elegant-layout.tsx` | Fixed | Hero fallback + Menu hide + Hours standardization |
| `app/layouts/minimal-layout.tsx` | Fixed | Hero fallback + Menu hide + Hours standardization |
| `app/layouts/rustic-layout.tsx` | Fixed | Hero fallback + Menu hide + Hours standardization |
| `components/sections/category-filter.tsx` | Fixed | Dynamic read Cuisine/Tags/Payment Methods |
| `app/page.tsx` | Fixed | Dynamic cuisine/more + Other grouping + payment_methods filtering |

### Files Needing Modification/Creation (Todo)

| File | Priority | Description |
| --- | --- | --- |
| `app/admin/components/merchant-form.tsx` | High | **Must split** — 1,400+ lines, split into 7 sub-files |
| `app/admin/components/merchant-form-shared.tsx` | High | **New** — Shared components after split |
| `app/admin/components/merchant-form-basic-tab.tsx` | High | **New** — Basic Info tab |
| `app/admin/components/merchant-form-contact-tab.tsx` | High | **New** — Contact tab |
| `app/admin/components/merchant-form-hours-tab.tsx` | High | **New** — Hours tab |
| `app/admin/components/merchant-form-settings-tab.tsx` | High | **New** — Settings tab |
| `app/admin/components/merchant-form-images-tab.tsx` | High | **New** — Images tab |
| `app/join-us/page.tsx` | High | **New** — Merchant self-submission page (business model transformation core) |
| `app/api/join/route.ts` | High | **New** — No-login submission API |
| `app/admin/components/pending-review.tsx` | High | **New** — Admin review list |
| `app/components/map-embed.tsx` | Medium | Prioritize lat/lng |
| `app/layouts/*` | Medium | Pass lat/lng to MapEmbed |
| `app/store/[merchant]/page.tsx` | Medium | Support `?preview=1` parameter |
| `app/admin/components/menu-manager.tsx` | Medium | To create |
| `app/api/admin/products/route.ts` | Medium | To create |
| `lib/analytics.ts` | Low | Add environment check, dev environment doesn't send tracking |
| `app/api/track/route.ts` | Low | Add robot filtering |

---

## Import/Export Pattern Quick Reference (Important!)

| Component | Export Method | Correct Import |
| --- | --- | --- |
| `AdminShell` | `export default` | `import AdminShell from '...'` |
| `StatCards` | `export default` | `import StatCards from '...'` |
| `TrendChart` | `export default` | `import TrendChart from '...'` |
| `DeviceChart` | `export default` | `import DeviceChart from '...'` |
| `ReferrerChart` | `export default` | `import ReferrerChart from '...'` |
| `EventsChart` | `export default` | `import EventsChart from '...'` |
| `LocationChart` | `export default` | `import LocationChart from '...'` |
| `HourlyChart` | `export default` | `import HourlyChart from '...'` |
| `StoriesChart` | `export default` | `import StoriesChart from '...'` |
| `MapStats` | `export default` | `import MapStats from '...'` |
| `SearchKeywordsTable` | `export default` | `import SearchKeywordsTable from '...'` |
| `MerchantTable` | `export default` | `import MerchantTable from '...'` |
| `ExportButton` | `export default` | `import ExportButton from '...'` |
| `RealtimeBadge` | `export default` | `import RealtimeBadge from '...'` |
| `DateRangePicker` | `export default` | `import DateRangePicker from '...'` |
| `SettingsPanel` | `export { SettingsPanel }` | `import { SettingsPanel } from '...'` Warning: only exception |
| `StoriesManager` | `export default` | `import StoriesManager from '...'` |
| `StoryEditor` | `export default` | `import StoryEditor from '...'` |
| `MerchantManager` | `export default` | `import MerchantManager from '...'` |
| `MerchantForm` | `export default` | `import MerchantForm from '...'` |
| `AuthProvider` | `export { AuthProvider }` | `import { AuthProvider } from '...'` |
| `useAuth` | `export { useAuth }` | `import { useAuth } from '...'` |
| `ClientLayout` | `export { ClientLayout }` | `import { ClientLayout } from '...'` |

**New Components After Split** (expected all `export default`):

| Component | Export Method | Correct Import |
| --- | --- | --- |
| `MerchantFormShared` | `export { ... }` | Multiple named exports |
| `MerchantFormBasicTab` | `export default` | `import MerchantFormBasicTab from '...'` |
| `MerchantFormContactTab` | `export default` | `import MerchantFormContactTab from '...'` |
| `MerchantFormHoursTab` | `export default` | `import MerchantFormHoursTab from '...'` |
| `MerchantFormSettingsTab` | `export default` | `import MerchantFormSettingsTab from '...'` |
| `MerchantFormImagesTab` | `export default` | `import MerchantFormImagesTab from '...'` |

---

## File Path Traps

Project has two parallel component directories:

- `components/sections/` — **legacy**, Stories page uses (e.g. `story-content.tsx`, `story-hero.tsx`)
- `app/components/sections/` — **new version**, other pages use

**Must verify import path before editing!**

**Special Attention:**

- `category-filter.tsx` is in `components/sections/` (legacy), not `app/components/sections/`
- `merchant-form.tsx` is in `app/admin/components/`
- `page.tsx` is in `app/page.tsx` (homepage)
- `join-us` page will be in `app/join-us/page.tsx` (new)

---

## Key Code Quick Reference

### Tracking Call

```typescript
import { trackEvent } from '@/lib/analytics';
trackEvent('page_view', { pageType: 'story', slug: articleSlug });
trackEvent('story_to_merchant', {
  pageType: 'story',
  slug: merchantSlug,
  detail: articleSlug
});
```

### Supabase Queries

```sql
-- View all merchants
SELECT * FROM merchants ORDER BY created_at DESC;

-- View merchant dishes
SELECT * FROM products WHERE merchant_id = 'xxx';

-- View categories
SELECT * FROM categories WHERE merchant_id = 'xxx' ORDER BY sort_order;

-- Add tagline field (if missing)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tagline TEXT;

-- Add payment_methods field (if missing)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT '{}';
```

### File Editing Method

1. Open https://github.com/chlew467779-new/bitesite
2. Find file -> Click pencil Edit
3. Paste complete code (new file line 1 must write `/* bitesite/file-path */`)
4. Commit message must be clear
5. Wait for Vercel deployment (30-60s)

---

## Confirmed Design Decisions (New Chat Doesn't Need to Rediscuss)

1. **Section component path:** `app/components/sections/store/` not yet created, current all sections in `app/components/sections/`
2. **operating_hours format:** Database keeps `jsonb` string format, frontend/backend add standardization layer (completed)
3. **Map component:** Google Maps Embed iframe, prioritize `lat,lng` coordinates, fallback to address search (not implemented)
4. **Hero fallback:** No cover_image shows solid color background + merchant name first letter (all 5 layouts implemented)
5. **Empty module strategy:** Content-less blocks directly `return null`, don't render any DOM (implemented)
6. **Hours display order:** Fixed Monday->Sunday, use `DAYS` array in `lib/hours.ts` (implemented)
7. **Cuisine/Area dropdown:** Preset + "Other" custom input (implemented)
8. **Tags multi-select:** Preset pills + custom input (Enter or + button) (implemented)
9. **Payment Methods:** Preset Cash/Cashless/Cards + custom input (implemented)
10. **"Other" Cuisine grouping:** cuisine_type not in preset list uniformly displays as "Other" filter button (implemented)
11. **More bar dynamic read:** Dynamically extract from database tags + payment_methods (implemented)
12. **Tags display rule:** Display all, wrap when needed (confirmed)
13. **Image upload solution:** Supabase Storage file upload primary, URL paste secondary (confirmed)
14. **Merchants don't need login:** Onboarding form submitted directly, approved and live (confirmed)
15. **Document soft requirement:** Not mandatory, but documents prioritized for approval (confirmed)
16. **Unsplash Link solution rejected:** Links expire, not real photos, poor merchant experience (confirmed)

---

## Pending Confirmation Questions (Recommend Confirming Before New Chat Starts)

1. **Stage B split order:** CH confirmed to do Stage B (split merchant-form) first, 7 rounds of commits
2. **Menu Tab in onboarding form?** Merchant self-submit needs to fill menu, or add after going live?
3. **Supabase Storage setup:** Need to create bucket and RLS permissions, does CH need detailed steps?
4. **CH IP confirmation:** 161.142.139.x is CH's test IP, don't accidentally delete when cleaning data
5. **What layout do pilot merchants use?** — Need CH confirmation for targeted testing

---

## Big File Split Detailed Plan (Stage B — For New Chat Reference)

### Why Must Split

- `merchant-form.tsx` currently ~1,400 lines, ~57KB
- Full select-replace risk extremely high (missing one line breaks everything)
- Continuing to add features (Menu Manager tab, Preview button, etc.) will hit 2,000+ lines

### Split File Structure

```javascript
app/admin/components/
├── merchant-form.tsx              <- Main shell (~200 lines)
│   ├── Features: Header (back button+title), Tab navigation (5 tab buttons),
│   │        Actions (Cancel + Save/Update + Delete), Delete Modal, Toast Container
│   ├── States: activeTab, saving, deleting, showDeleteConfirm, errors, saveError, toasts
│   ├── Imports: 5 tab components + shared
│   └── export default MerchantForm
│
├── merchant-form-shared.tsx       <- Shared (~120 lines)
│   ├── Exports:
│   │   - Toast component (with animate-in slide-in-from-right)
│   │   - isLikelyImageUrl(url)
│   │   - isLikelyPdfUrl(url)
│   │   - isValidHttpUrl(url)
│   │   - generateSlug(name)
│   │   - MerchantFormProps interface (includes payment_methods)
│   │   - Toast interface
│   │   - LAYOUTS constant
│   │   - DAYS constant
│   │   - FEATURES constant
│   └── Note: This file exports multiple things (named exports), not default export
│
├── merchant-form-basic-tab.tsx    <- Basic Info (~350 lines)
│   ├── Receives props: form, errors, isEditing, merchant, updateField
│   ├── Internal states: tagInput, paymentMethodInput
│   ├── Features:
│   │   - Name (required, auto-generates slug)
│   │   - Slug (required, /store/ prefix)
│   │   - Tagline
│   │   - Description
│   │   - Layout (5 card selections)
│   │   - Cuisine Type (dropdown 15 presets + Other custom)
│   │   - Area (dropdown 15 areas + Other custom)
│   │   - Tags (12 preset pills + custom input + selected display)
│   │   - Payment Methods (3 preset pills + custom input + selected display)
│   └── export default MerchantFormBasicTab
│
├── merchant-form-contact-tab.tsx  <- Contact (~180 lines)
│   ├── Receives props: form, errors, updateField
│   ├── Features: Address, Phone, WhatsApp (required), Email, Website, Instagram, Facebook, Latitude, Longitude
│   ├── URL warnings: websiteWarning, instagramWarning, facebookWarning (yellow border + hint)
│   └── export default MerchantFormContactTab
│
├── merchant-form-hours-tab.tsx    <- Hours (~250 lines)
│   ├── Receives props: hoursSlots, setHoursSlots (or related setter function)
│   ├── Features:
│   │   - 7 day cards (Monday->Sunday)
│   │   - Set as Closed / Set as Open toggle
│   │   - Multi time slot input (Start - End)
│   │   - Add time slot / Remove slot
│   │   - Copy Monday to all
│   ├── Dependencies: lib/hours.ts (parseOperatingHoursString, formatOperatingHoursToString, DayHours, TimeSlot)
│   └── export default MerchantFormHoursTab
│
├── merchant-form-settings-tab.tsx <- Settings (~150 lines)
│   ├── Receives props: form, updateField, updateFeature
│   ├── Features:
│   │   - Published toggle (switch)
│   │   - Status (active/inactive buttons)
│   │   - Page Sections (9 Features checkbox cards)
│   └── export default MerchantFormSettingsTab
│
└── merchant-form-images-tab.tsx   <- Images (~150 lines)
    ├── Receives props: form, updateField, logoError, coverError, setLogoError, setCoverError
    ├── Features:
    │   - Logo Image URL (input+preview+failure message+URL warning)
    │   - Cover Image URL (input+preview+failure message+URL warning)
    │   - Menu PDF URL (input+URL warning)
    └── export default MerchantFormImagesTab
```

### Split Execution Order (Recommended)

**Round 1:** Create `merchant-form-shared.tsx`
**Round 2:** Create `merchant-form-basic-tab.tsx`
**Round 3:** Create `merchant-form-contact-tab.tsx`
**Round 4:** Create `merchant-form-hours-tab.tsx`
**Round 5:** Create `merchant-form-settings-tab.tsx`
**Round 6:** Create `merchant-form-images-tab.tsx`
**Round 7:** Rewrite `merchant-form.tsx` main shell, import all child components

**Only change 1-2 files per round, test Admin form after commit.**

---

## Merchant Self-Onboarding Detailed Plan (For New Chat Reference)

### Goal

Let merchants fill info and submit themselves, CH only needs to click Approve/Reject in Admin backend.

### Involved Files

| File | Type | Description |
| --- | --- | --- |
| `app/join-us/page.tsx` | New | Merchant onboarding form page (6 tabs, similar to Admin form but merchant-facing) |
| `app/api/join/route.ts` | New | POST endpoint, receives merchant submission data, inserts into merchants table (status=pending_review) |
| `app/admin/components/pending-review.tsx` | New | Admin review list, shows pending_review status merchants |
| `app/admin/components/admin-shell.tsx` | Modify | Add "Pending Review" tab |
| `app/admin/page.tsx` | Modify | Add pending-review tab rendering |
| `app/api/admin/merchants-crud/route.ts` | Modify | Support review status flow (approve/reject) |

### Onboarding Form 6 Tabs (Similar to Admin Form but Simplified)

1. **Basic Info:** name, slug, cuisine_type, area, tags, payment_methods
2. **Contact:** address, phone, whatsapp, email, website, instagram, facebook
3. **Hours:** Structured operating hours
4. **Images:** logo, cover (mandatory), menu_pdf, gallery (optional)
5. **Menu:** Categories + dishes (name, price, description) — optional but recommended
6. **Settings:** Style selection (5 types), description/tagline

### Technical Points

- No login/auth required
- After submit status = `pending_review`, is_published = false
- Anti-duplicate: Same WhatsApp can only submit once within 24 hours
- Image upload: Supabase Storage (needs bucket setup)
- After approval: CH clicks Approve -> is_published = true, auto goes live

---

## Map Coordinate Fix Detailed Plan (For New Chat Reference)

### Problem

`app/components/map-embed.tsx` only uses `address` string search, completely doesn't use `latitude/longitude`.

### Fix Plan

1. Modify `app/components/map-embed.tsx`:

- If `lat` and `lng` both have values, use Google Maps Embed iframe `q=lat,lng` mode
- If coordinates empty, fallback to `q=address` mode

2. Modify 5 layout files:

- Pass `latitude` and `longitude` to `<MapEmbed />`

### Involved Files

- `app/components/map-embed.tsx`
- `app/layouts/classic-layout.tsx`
- `app/layouts/elegant-layout.tsx`
- `app/layouts/minimal-layout.tsx`
- `app/layouts/modern-layout.tsx`
- `app/layouts/rustic-layout.tsx`

---

*Document ends. Next Chat recommends starting from "Stage B: Split merchant-form.tsx", changing 1-2 files each time.*
