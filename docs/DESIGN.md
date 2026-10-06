# BiteSite design rules (2026-10 redesign)

Everyone (Claude, ChatGPT, people) follows this file. New looks, colours, fonts and
new shared parts are added **only by Claude**; everyone else builds pages from the parts
in `components/ui/` and the tokens below. If you need something that is not here, leave a
note in the work queue instead of inventing a style.

Most visitors use phones: design at **375–390px first**, desktop is the same layout, wider.

## Colours (Tailwind classes come from `app/globals.css` `@theme`)

| Token | Hex | Use |
|---|---|---|
| `ink` | #17201B | main text |
| `ink-2` | #3D4741 | body copy on white, footer links |
| `muted` | #5B655E | secondary text, icons |
| `brand` | #1F4D3A | primary buttons, selected chips, links |
| `brand-hover` | #163828 | hover of brand |
| `brand-soft` | #EAF2EC | selected / active background |
| `kaya` | #E9A23B | one highlight button per screen (e.g. "Join BiteSite"); text on it is `kaya-ink` #2A1A04 |
| `surface` | #F3F5F0 | cards, inputs |
| `line` / `line-strong` | #E3E7DF / #DDE2D8 | borders, dividers / outlined buttons and chips |
| `open` / `open-bg` / `open-dot` | #1E6B43 / #E6F4EA / #1E8A50 | "Open now" |
| `soldout` / `soldout-bg` | #A23B2A / #FBE9E5 | "Sold out", warnings |

Page background is white. Write `text-ink`, `bg-surface`, `border-line` — never new hex
values. (The old `fresh-*`, `luxury-*`, `jp-*` tokens remain only for pages not yet redesigned.)

## Type

- Plus Jakarta Sans (English / Malay) + Noto Sans SC (中文), loaded with `next/font` in
  `app/layout.tsx`. `font-serif` is now an alias of the same font; Playfair is gone.
- Headings: weight 800 (`font-extrabold`), tight tracking (`tracking-[-0.02em]`, big titles `-0.03em`).
  Page title 28px on phones; section title 20px (`<SectionTitle>`).
- Body 16px, line height 1.5. Small print not below 12px. Inputs always 16px (stops iOS zoom).

## Shape and spacing

- Corners: cards 20–24px, buttons 14–16px, chips / pills fully round.
- Spacing on a 4px grid; page side padding 16px (`px-4`).
- **Every tap target ≥ 44px**; main buttons 48–52px tall.
- No scroll fade-in animations on public pages (`FadeIn` is now a plain wrapper; don't add new ones).

## Shared parts (`components/ui/`)

| Part | When |
|---|---|
| `Button` / `buttonClasses()` | every button; `variant` primary · kaya · secondary · ghost, `size` md 44 · lg 48 · xl 52, `block` for full width. Use `buttonClasses()` on `<Link>`. |
| `IconButton` | round 44px icon-only button; `label` is required; `variant="overlay"` on photos |
| `Chip` / `chipClasses()` | filter pills; `selected` for the on state |
| `Card`, `SectionTitle` | grey info cards; section headings |
| `StatusPill` | 28px labels: `open`, `closed`, `soldout`, `neutral`, `onPhoto`; `dot` adds the green dot |
| `SearchInput` | 52px search field; `label` is for screen readers |
| `Sheet` | bottom sheet on phones / dialog on desktop (booking form, filters) |
| `BiteSiteLogo` | the mark + wordmark |

## Restaurant page styles

All restaurant pages share one structure. A merchant picks **colour** (Forest #1F4D3A,
Amber #8A4B0F, Chilli #A2341F, Ocean #1E4E79, Stone #44403C, Night #0F172A with gold #FDE68A)
and **menu look** (list or photo grid). Existing layout keys map: modern→Forest,
classic→Amber, rustic→Chilli, minimal→Stone, elegant→Night.

## Checking a change

At 375px and 1280px: `document.documentElement.scrollWidth` equals the window width, every
button/link measures ≥ 44px high, and test with a filled store (`zz-full-fixture`), not an
empty one.
