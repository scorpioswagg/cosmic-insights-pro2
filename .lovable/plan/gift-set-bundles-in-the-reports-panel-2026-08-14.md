# Gift Set Bundles in the Reports Panel

Add a "Gift Sets" section to the reports panel so visitors can buy the Oracle Vault bundles (already defined in code) in one click, at a discount.

## What the user sees

A new section above the report categories, titled "Gift Sets & Bundles", with one card per bundle:

- Bundle icon, title and tagline
- Bundle price in large type, with the full list price struck through and a "Save $X (Y%)" badge
- Count of included reports plus the list of included report titles (collapsible when longer than ~6 titles, so the 27-report Complete Set card stays readable)
- The short gift note
- A primary button: "Gift this set — $X" that starts Stripe checkout
- If already signed in and every report in the set is unlocked, the button becomes a disabled "You own this set"; admins see "Included"

Cards use the existing midnight/gold styling of the other report cards — no new colors or fonts.

## Behaviour

- Clicking the button requires a real (non-anonymous) Google session, same rule as single-report purchase; otherwise it shows the existing "Please sign in with Google before purchasing." message.
- On click it calls the existing bundle checkout server function and redirects to Stripe. Errors surface through the same inline error line and toast used by single purchases.
- A per-bundle loading state disables only the clicked button.

## Technical notes

- File touched: `src/components/astrology/ReportsPanel.tsx` only.
- Imports: `GIFT_BUNDLES`, `bundlePricing` from `@/lib/reports/bundles`; `createBundleCheckout` from `@/lib/reports/bundle-checkout.functions`; reuse `formatPrice` and `REPORTS` for titles.
- Prices come from `bundlePricing()` (list, price, savings, count) — no new pricing logic.
- New local state `purchasingBundleId`, and a `purchaseBundle(id)` handler mirroring the existing `purchase(reportId)` flow (session check, `useServerFn` call, `window.location.assign(res.url)`).
- Ownership check reuses the existing `unlockedIds` set / `isAdmin` flag.
