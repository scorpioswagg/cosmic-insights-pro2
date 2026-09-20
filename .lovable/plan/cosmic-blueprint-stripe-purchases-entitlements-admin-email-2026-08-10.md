# Cosmic Blueprint — Stripe Purchases, Entitlements, Admin & Email

Builds on what already exists (report catalog in the database, admin role system, Resend email service with delivery logging, PDF generation). Nothing working gets replaced.

## What you'll be able to do when this is done

- Browse the report catalog and clearly see Free / Included / Locked / Unlocked / Purchase states.
- Buy a single report through real Stripe Checkout.
- Access unlocks only after Stripe's verified webhook confirms payment — never just because you came back from the checkout page.
- Get a confirmation email from oracle@mycosmicblueprint.online, exactly once even if Stripe retries.
- See everything you own in a **My Reports** area.
- Manage administrators, prices, publish state, purchases and entitlements from the admin dashboard.

## Data changes

Three new tables plus access rules:

```text
report_purchases   user_id, report_id, stripe_session_id (unique),
                   stripe_payment_intent, amount_cents, currency,
                   status (pending|paid|refunded|failed), email_sent_at
report_entitlements user_id, report_id (unique together), source
                   (purchase|admin_grant|free|admin_role), purchase_id,
                   status, granted_at, expires_at
admin_audit_log    actor, action, target_user, target_report, metadata
```

`report_products` gains `stripe_price_id`, `stripe_product_id`, `currency`, `slug`.

Access rules: customers can read only their own purchases and entitlements and can never write them — only verified server-side code creates them. Admins can read everything.

## Purchase flow

1. **Purchase Report** button on any paid, published report (signed-in users only).
2. Server looks up the report, confirms it's published and paid, resolves the Stripe price server-side (creating the Stripe product/price on first use), and opens a Checkout Session with the user id and report id in metadata. A `pending` purchase row is written.
3. Stripe redirects to `/checkout/success` which shows "Payment received — we're confirming your purchase," then polls entitlement status and flips to "Your report is unlocked!" with an open-report button. `/checkout/cancel` offers a clean retry.
4. `POST /api/public/webhooks/stripe` verifies the Stripe signature, handles `checkout.session.completed`, `checkout.session.async_payment_succeeded/failed`, `payment_intent.payment_failed` and `charge.refunded`. On success it marks the purchase paid, creates the entitlement for that one report, and sends the Resend confirmation. Repeat deliveries of the same event are recognised and ignored — no duplicate entitlement, no duplicate email.

Refunds revoke the entitlement.

## Access enforcement

A single server-side `resolveReportAccess(userId, reportId)` decides everything, in order: admin role → free/included report → active entitlement → otherwise locked. Report generation, PDF download, signed storage URLs and the MCP report tool all call it. Locked means blocked at the data layer — hiding a button is never the gate.

## Admin dashboard

`/admin` becomes a hub with tabs:
- **Administrators** — live list from the database (email, role, status, created date), with promote/revoke actions and audit logging. No hard-coded lists.
- **Reports** — existing pricing/publish table, plus Stripe price id and a "Sync prices to Stripe" action.
- **Purchases** — customer, report, amount, status, date, email status; manual grant/revoke entitlement.
- **Emails** — existing delivery log.

`oracle@mycosmicblueprint.online` is granted the admin role. If that account hasn't signed up yet, the grant is stored so it applies the moment the account is created — no fake credentials, no stored passwords.

## Email

Reuses the existing Resend service and delivery log. Purchase confirmation is sent from oracle@mycosmicblueprint.online after the entitlement exists, with report name, amount, date, and a link to open it. Guarded by `email_sent_at` so retries can't duplicate it.

## Testing

Unit tests for webhook signature verification, idempotent replay, entitlement isolation (buying report A never unlocks B), refund revocation, and the access resolver. Plus a browser pass over catalog, checkout entry, success page, My Reports and admin at mobile and desktop widths.

## Configuration you'll need to confirm

The Stripe secret is currently stored under a misspelled name (`SRIPE_API_SECTRET_KEY`). The code will read it, but I'd recommend re-saving it as `STRIPE_SECRET_KEY`. You'll also need to point a Stripe webhook endpoint at `https://yourcosmicblueprint.lovable.app/api/public/webhooks/stripe` and confirm the signing secret matches `STRIPE_WEBHOOK`. I'll list any missing values instead of inventing them.

## Technical notes

- Checkout session creation and the entitlement resolver are authenticated `createServerFn`s; the webhook is a public server route with signature verification and service-role writes.
- Stripe price ids are resolved server-side from the report id only; the client never sends a price or amount.
- All new tables get explicit grants plus owner-scoped read policies; writes are service-role only.
