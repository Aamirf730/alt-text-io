# Alt Text Pro design system (yellow + white)

Decided 2026-10-24 by the owner: the brand is **yellow + white only**. Black is removed everywhere (website, customer dashboard, admin portal, WordPress plugin, emails, logo, icons). Text and icons use a **dark gray** so everything stays readable and passes WCAG AA, which matters for an accessibility product.

## Colour tokens

| Token | Hex | Use |
|---|---|---|
| `yellow` | `#FEE11C` | Brand colour. Primary buttons, active states, key highlights, logo disc. |
| `yellow-strong` | `#F2CF00` | Hover/pressed state of yellow surfaces, focus rings. |
| `yellow-soft` | `#FFF3B0` | Badges, selected rows, active nav item, logo cap. |
| `yellow-tint` | `#FFFBEA` | Section and page backgrounds, card headers, table stripes. |
| `white` | `#FFFFFF` | Cards, inputs, secondary buttons, main backgrounds. |
| `ink` | `#3F3F46` | All body text, headings, icons, primary-button text. (8:1 on yellow, 10:1 on white) |
| `ink-muted` | `#6B6B73` | Secondary text, captions, placeholders. (5.2:1 on white) |
| `line` | `#EFE3A3` | Borders and dividers (yellow-tinted). |
| `line-strong` | `#E2CE5A` | Input borders, outlined buttons, focused card borders. |

Status colours are allowed only for meaning, never decoration: success `#15803D`, warning `#B45309`, error `#B91C1C`, each on a pale background of the same hue.

**Never use:** `#000`, `black`, `#111`, `#0f172a`, `#1A1C1E`, `bg-black`, `text-black`, `slate-900`, or any near-black. Replace with `ink` (text/icons) or `yellow`/`white` (surfaces). Never put white or yellow text on yellow or white.

## Buttons

One shape everywhere: height 44px (36px for small), radius 12px, padding 0 20px, font 15px/600, icon 18px with 8px gap, icon and label vertically centred (`inline-flex; align-items: center; justify-content: center`).

| Variant | Background | Text/icon | Border | Hover |
|---|---|---|---|---|
| Primary | `yellow` | `ink` | none | `yellow-strong` |
| Secondary | `white` | `ink` | 1px `line-strong` | background `yellow-tint` |
| Ghost / link | transparent | `ink` (underline on hover) | none | background `yellow-soft` (stays visible on `yellow-tint` surfaces) |
| Destructive | `white` | error | 1px error | pale red background |

Full-width buttons only in narrow cards/modals. Buttons in one row share the same height and variant hierarchy (one primary per group).

## Layout and alignment rules

- Icons sit inline with text using flex + `align-items: center`; never nudge with margins or `vertical-align`. Icon size matches the text line (16px at 14px text, 18px at 15-16px, 20px at 18px+).
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Cards: 24px padding, 16px radius, 1px `line` border, no heavy shadows (at most `0 1px 2px rgba(63,63,70,0.06)`).
- Headings and their supporting text left-align inside cards; centred text only in hero and empty states.
- Grids of cards keep equal heights; actions pinned to the card bottom.
- Focus: 3px `yellow-strong` outline, 2px offset, on every interactive element.

## Typography

Existing fonts stay (Outfit for display headings, the current sans for body). Body 16px/1.6 on the website, 14px in dense dashboards and the plugin. Headings in `ink`; no all-caps paragraphs; uppercase only for small labels (12px, letter-spacing 0.06em, `ink-muted`).

## Logo and icons

- Logo source: `frontend-next/public/brand/logo.svg` (yellow disc, pale-yellow cap, yellow orb, wordmark in `ink`). PNGs and favicons are rendered from it.
- Small sizes (favicon, 16-48px, plugin menu) use the simplified "ALT" mark: `frontend-next/public/brand/logo-mark.svg`.
- Line icons (lucide/dashicons) in `ink`; inside a yellow chip use `ink` on `yellow-soft`.

## Emails

Same tokens, inline styles only, 560px card on a `yellow-tint` page, `ink` text, primary button `yellow` with `ink` text, 12px radius. No black.

## Checking a page

Screenshots for review are taken with the scratchpad Playwright setup (see `progress.md`) at 1440px and 390px widths.
