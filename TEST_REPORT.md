# Porty Order validation — 1 November 2026

## Executed

The shared live API core passes 13 automated tests against an isolated SQLite database created from the actual migrations:

1. Public catalogue and unauthenticated access rejection.
2. Pending partner restrictions and hidden catalogue records.
3. Server-calculated money values and duplicate request idempotency.
4. Full customer → business → courier → PIN-confirmed delivery journey, including notifications.
5. Competing courier claims and cross-account order isolation.
6. Customer/admin cancellation rules and recorded reasons.
7. Item availability, quantities, single-store items and supported areas.
8. Origin/CSRF protections.
9. Private one-time owner activation.
10. Courier pickup/delivery coverage and driver ownership.
11. Wrong-PIN attempts and lockout; no self-approval.
12. Stale or manipulated price quote rejection.
13. Support ticket privacy, administrator reply and notification.

JavaScript syntax checks and the Vinext production build passed. Schema migrations were applied to local D1 and the hosted deployment succeeded. Anonymous production browsing was verified against the hosted database. The anonymous storefront rendered successfully through the managed browser preview against the local API.

The portable Bolt frontend also passed its Vite production build. This checks frontend compilation, not a live Supabase connection.

## Verification boundaries

Tests exercise the production API logic with separate authenticated identities supplied by a test harness; they do not create real ChatGPT users. Hosted ChatGPT sign-in is supplied by Sites. A signed-in multi-device production test with actual merchant/courier/customer accounts remains an owner/tester task after registration. No test accounts, businesses or orders are seeded into the production database.

The portable Vite/Supabase adapter is supplied as migration code. It has not been connected to, migrated into, or end-to-end tested against the user's Bolt database or email provider. Bolt must execute the integration checklist in BOLT_DATABASE_PROMPT.txt before claiming its deployment is operational.

Cash on delivery, in-app notifications and company-managed drivers are implemented. Card processing, email/SMS order alerts, independent driver login, automatic payouts and live GPS have not been connected and are not represented as working features.
