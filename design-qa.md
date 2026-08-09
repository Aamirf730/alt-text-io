# Design QA — Homepage hero reference

## Latest addition — Screenshot-matched pricing section

### Result

passed

### Evidence

- Source visual: `/Users/aamirfaiz/Desktop/Screenshot 2026-08-09 at 5.04.10 PM.png` (2126×1180).
- Implementation capture: `/Users/aamirfaiz/Desktop/Projects/Alt-text/v3 - react to next - working/app-main/design-qa-pricing-local.png` (1485×942 browser viewport, logged-out localhost state).
- Route: `http://localhost:3000/`, pricing section at `#pricing`.
- Interaction check: Monthly is selected by default; Annual switches the Lite price to `$30` and Monthly returns it to `$3`. Plan CTAs remain wired to the existing selection flow.
- Browser console check: zero errors after the local dev server restart.

### Fidelity review

- Typography and hierarchy: centered `Pricing` eyebrow, oversized two-line headline, muted subtitle, and compact billing control follow the supplied composition.
- Layout: four equal-height cards sit in one desktop row with generous gutters; card actions are anchored at the bottom and the Standard card uses the requested yellow outline, badge, and primary action.
- Colors: warm off-white section background, white cards, black structure/text, muted gray secondary text, and `#FEE11C` brand accents match the reference and existing site tokens.
- Copy and states: Free, Lite, Standard, and Pro labels, credit allowances, features, annual savings label, and disclaimer are represented; the active billing state is visible.
- Remaining differences: the local viewport includes the existing sticky site navigation above the section, while the supplied visual is a section-only crop. This is intentional product chrome rather than a pricing fidelity issue.

### Comparison history

1. Initial pricing pass — no P0/P1/P2 findings after aligning the card grid, heading scale, toggle, and featured-card treatment with the source visual.

## Result

passed

## Latest addition — Media library showcase

### Result

passed

### Evidence

- Source visual: `/Users/aamirfaiz/Desktop/Screenshot 2026-08-09 at 1.13.52 PM.png` (1952×1216).
- Desktop implementation capture: `/Users/aamirfaiz/Desktop/Projects/Alt-text/v3 - react to next - working/app-main/design-qa-media-library.png` (1952×1216 browser viewport, default density).
- Mobile implementation capture: `/Users/aamirfaiz/Desktop/Projects/Alt-text/v3 - react to next - working/app-main/design-qa-media-library-mobile.png` (390×844 CSS viewport, default density).
- Route: `http://localhost:3000/`, logged-out state.
- Desktop comparison state: section heading, WordPress-style media-library shell, two media rows, centered “After Alt Text Pro” marker, and generated-alt-text card visible together. The existing sticky site navbar remains intentional product chrome; the supplied source is a section-only crop.
- Responsive check: 390×844 document scroll width matched the viewport width with no horizontal overflow; the sidebar reflows into a compact two-column navigation and the media table remains contained in its own horizontal scroll region.
- Browser console check: zero errors during the desktop and mobile captures.

### Fidelity review

- Typography: bold Outfit display heading and compact UI labels preserve the source hierarchy and wrapping.
- Spacing and layout: centered heading/subtitle, rounded bordered shell, dark sidebar, table rhythm, overlap pill, and yellow result card follow the supplied composition.
- Colors and tokens: white canvas, black structure, WordPress-style dark rail, muted blue UI labels, and `#FEE11C` result accent are consistent with the screenshot and current brand.
- Image quality: existing `mountain-landscape.jpg` is reused for both media rows; the existing WordPress logo asset is cropped to its icon mark rather than replaced with a placeholder.
- Copy: “Better alt text, automatically.”, “Media Library”, “After Alt Text Pro”, and generated description text match the supplied reference.

### Comparison history

1. Initial section pass — no P0/P1/P2 findings. The wide table is contained on mobile while preserving the desktop composition; remaining differences are limited to existing navbar chrome and the project’s available mountain asset.

## Result

passed

## Evidence

- Source visual: `/Users/aamirfaiz/Desktop/Screenshot 2026-08-09 at 3.15.15 AM.png` (2048×922).
- Implementation capture: `/Users/aamirfaiz/Desktop/Projects/Alt-text/v3 - react to next - working/app-main/design-qa-hero-implementation.png` (2048×922, browser viewport, default density).
- Responsive issue source: `/Users/aamirfaiz/Desktop/Screenshot 2026-08-09 at 11.15.37 AM.png` (2048×922 including browser chrome and display scaling).
- Responsive implementation capture: `/Users/aamirfaiz/Desktop/Projects/Alt-text/v3 - react to next - working/app-main/design-qa-hero-responsive-1327x631.png` (1327×631 CSS viewport).
- Responsive comparison: `/Users/aamirfaiz/Desktop/Projects/Alt-text/v3 - react to next - working/app-main/design-qa-responsive-comparison.jpg`. Because the source includes browser chrome and display scaling, the comparison evaluates normalized composition rather than one-to-one pixel density.
- Local route: `http://localhost:3000/`.
- Responsive check: 390×844 viewport; document scroll width matched the 390px client width with no horizontal overflow.
- Responsive desktop check: at the user's 1327×631 CSS viewport, the headline, copy, both CTAs, credit note, image, and generated-alt-text card all end within the 631px fold, with no horizontal overflow.
- Wide desktop check: 2048×922 retained the intended oversized two-line composition without overflow.
- Interaction check: the image chooser, primary CTA, plugin link, copy control, sample alt text, and generated-alt-text panel were present; copy action displayed “Copied to clipboard!”.
- Browser console check: zero errors after the responsive correction.

## Comparison notes

- The hero now follows the requested hierarchy: oversized two-line “Make Every Image Speak” headline, supporting copy, yellow/white CTAs, credit note, tilted image frame, and overlapping generated-alt-text card. The previously added WordPress publisher badge was removed after review.
- Desktop geometry was tuned against the supplied 2048×922 reference after an initial pass exposed excess max-width margins. The final pass widened the hero canvas, matched the left-column rhythm, and aligned the image/card overlap.
- The existing site navigation remains visible above the hero as product chrome; the supplied reference is a hero-only crop.

## Comparison history

1. Initial implementation — P1: hero was constrained by the previous `max-w-7xl` wrapper and sat too far inward at the reference viewport.
2. Wide-canvas pass — resolved the P1 by using a 1920px hero canvas and rebalancing the desktop columns and visual panel widths.
3. Typography/rhythm pass — resolved remaining P2 spacing and scale differences by matching the headline, paragraph line height, CTA rhythm, and panel overlap at the reference viewport.
4. Final QA — no remaining P0/P1/P2 findings. P3 follow-ups are limited to the reference photo being represented by the existing `mountain-landscape.jpg` asset and the WordPress marks using lightweight text treatments because the project’s existing logo asset is a horizontal lockup.
5. Review adjustment — removed the full-width publisher badge and left the existing navbar dimensions unchanged; the top navigation remains the same 106px rendered height at the reference desktop viewport.
6. Responsive fold correction — P1: the 1280px `xl` breakpoint changed the headline to a fixed 160px size, wrapping it across four lines and pushing the supporting content below the user's 631px-high viewport. Replaced the breakpoint jump with fluid headline scaling, reserved ultra-wide offsets for viewports of at least 1800px, and tightened medium-desktop vertical spacing and card padding. Rechecked the logged-out localhost homepage at the top of the page; no P0/P1/P2 findings remain.

## Release state

- Local-only change; no production site, Netlify deploy, Supabase data, or WordPress.org content was mutated.
- `npx tsc --noEmit`: passed.
- `npm test -- --run`: passed (7 files, 52 tests).
- `npm run build`: passed; existing lint warnings remain outside this hero change.

Final result: passed
