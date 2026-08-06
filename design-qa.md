# Alt Text Pro onboarding modal design QA

- Source visual truth: `/var/folders/jq/fxyb971556jblqw43sff4fnr0000gn/T/TemporaryItems/NSIRD_screencaptureui_ULDTIk/Screenshot 2026-08-06 at 2.21.39 AM.png`
- Browser-rendered implementation: `wordpress-plugin/tests/onboarding-modal-mobile.png`
- Source pixels: 2360 × 1172. The source is the reported broken desktop state, not a fidelity target.
- Implementation pixels/CSS viewport: 390 × 844 at 1× density.
- Additional desktop evidence: browser-rendered 1440 × 900 inspection measured a 720 × 453 modal, two equal 319 × 236 cards, and equal 281 × 44 primary actions.
- State: default connection modal, no validation or network response shown.

## Full-view comparison

The source establishes the defects to remove: mixed old markup/new styles, a wrapped connect icon, an orphaned manual-save action, uneven card rhythm, and a password-manager badge occupying the input. The implementation uses one shared modal structure on Dashboard and Settings, keeps both actions inside equal-height cards at desktop, and stacks the cards without horizontal overflow at 390 px.

The comparison is improvement-based rather than a pixel-for-pixel recreation because the user explicitly asked to replace the broken visual treatment. No density normalization was used between the desktop defect reference and mobile responsive evidence. Desktop proportions were checked separately in the browser at the measurements recorded above.

## Focused region comparison

- Header: a dedicated fixed-size Dashicon now sits above a single unbroken heading; the close action uses a real Dashicon and a 36 × 36 target.
- Automatic card: the recommendation label, copy, and full-width action form one vertical hierarchy; the arrow icon cannot shrink or wrap below the label.
- Manual card: the API-key icon, input, dashboard help, validation region, and save action are grouped in one card. Supported password managers are asked not to inject controls into the API-key field.
- Footer: the security statement is secondary and the defer action remains visually quiet.
- Responsive layout: the 390 × 844 capture keeps all content and controls visible with no horizontal clipping.

## Required fidelity surfaces

- Fonts and typography: preserves the WordPress/Alt Text Pro font stack and existing weights; heading, card title, body, label, and helper-text hierarchy remain distinct with controlled wrapping.
- Spacing and layout rhythm: desktop cards are equal height with equal action dimensions; mobile cards use consistent internal padding and a centered divider.
- Colors and visual tokens: preserves the existing primary teal, soft teal, neutral borders, white surfaces, and semantic success/error colors.
- Image and icon quality: no new raster assets or approximated icons were introduced. Visible icons use the installed WordPress Dashicons library with explicit fixed sizing.
- Copy and content: automatic and manual paths are named by outcome, the manual instructions point to the dashboard, and the storage note accurately says the key is encrypted before storage.

## Comparison history

1. Initial review found a P1 markup/stylesheet mismatch, P1 detached manual action and wrapped icon, and P2 incorrect `aria-hidden` state when the dialog opened.
2. Restored a shared modal template, moved actions into their cards, fixed icon sizing and responsive rules, replaced text-symbol status marks with Dashicons, and synchronized the dialog's accessibility state.
3. Post-fix browser review found no actionable P0/P1/P2 visual issues. The mobile screenshot and desktop measurements confirm stable sizing and responsive behavior.

## Residual test limits

- Opening the real Alt Text Pro authentication popup was not exercised because it would enter an external account flow. Its default, loading, blocked-popup, success, and error presentation is implemented with the same fixed icon/status system.
- Browser console inspection during the stable desktop capture showed no warnings or errors.

final result: passed

---

# Alt Text Pro automatic-connect recovery design QA

- Source visual truth: `/var/folders/jq/fxyb971556jblqw43sff4fnr0000gn/T/TemporaryItems/NSIRD_screencaptureui_maqn4U/Screenshot 2026-08-06 at 2.22.45 AM.png`
- State: authenticated automatic-connect fallback after WordPress acknowledgement could not be confirmed.
- Source pixels: 1000 × 1178. The screenshot is defect evidence, not a fidelity target.

## Full-view comparison

The source shows raw, unstyled markup: an oversized key icon, edge-to-edge text, a fully visible API key, and no trustworthy product framing. Code inspection confirmed that this was deterministic: the fallback returned before the page's scoped stylesheet mounted.

The corrected state uses the existing Alt Text Pro teal and neutral palette in a centered 470 px card, constrains typography and spacing, groups the warning and recovery actions, and responds below 520 px without horizontal overflow. Shared styling now covers loading, confirmation, connecting, success, and recovery states instead of only the sign-in form.

## Focused region comparison

- Brand and hierarchy: the real Alt Text Pro logo, a fixed-size Lucide key icon, an eyebrow, and a concise heading establish product context.
- Status: the failed acknowledgement is presented as a contained warning, followed by reassurance that the account is safe.
- Secret handling: the API key is password-masked by default, supports deliberate reveal/hide, and has a separate copy action. Password-manager suppression attributes reduce intrusive overlays.
- Instructions: three numbered steps replace the long inline path and keep the fallback actionable.
- Accessibility: visible keyboard focus, semantic labels, a status region, hidden decorative icons, and full-width mobile actions are included.

## Comparison history

1. The defect screenshot and source review identified a P1 stylesheet lifecycle failure and a P1 secret-exposure problem.
2. Added a shared state stylesheet and redesigned the fallback around a compact recovery card.
3. Added regression checks for shared state styling and default key masking; TypeScript, the full test suite, and a production build pass.

## Residual test limits

- The authenticated failure state was not recreated with a real account because that would resend a live API key during verification.
- Responsive behavior was reviewed from the rendered CSS rules and production compilation, not a second browser screenshot. A post-deploy smoke test with a rotated test key remains the release gate.

final result: passed with post-deploy visual smoke test required

---

# Alt Text Pro connection form branding polish

- Source visual truth: `/var/folders/jq/fxyb971556jblqw43sff4fnr0000gn/T/TemporaryItems/NSIRD_screencaptureui_Cx9GpW/Screenshot 2026-08-06 at 2.54.01 AM.png`
- State: unauthenticated connection form in the local preview.

## Focused review

The review found two visual inconsistencies: the logo did not have an explicit centered block layout, and the primary form action still used an unrelated indigo-to-purple gradient. The logo now centers against the form content column, while the primary action, focus treatment, confirmation state, and account toggle use the existing Alt Text Pro teal family.

## Verification

- Added focused regression assertions for centered logo layout and removal of the stale purple palette.
- Full frontend suite passes 7 files/32 tests; TypeScript passes; and `git diff --check` passes.

final result: passed
