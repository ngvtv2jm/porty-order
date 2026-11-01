# Porty Order

Jamaican local shopping and delivery marketplace, launching in Portland.

This repository contains the Bolt-ready Vite application at its root, with the PostgreSQL migration and server-side API adapter under `supabase/`. Import this repository into Bolt and paste `BOLT_DATABASE_PROMPT.txt` to configure the database, authentication and server functions.

## Setup

1. Install with `npm ci`.
2. Set public frontend settings from `.env.example` in `.env.local`.
3. Connect the real database/auth provider, apply the schema and deploy the marketplace server function. Server secrets must stay in the backend.
4. Set exact allowed origins and auth confirmation/password-reset redirect URLs.
5. Run `npm run build`. The frontend build does not deploy the database or backend.

The included backend adapter uses Supabase Edge Functions and a private PostgreSQL pooler connection. The setup prompt covers adaptation to Bolt Database where supported. Do not replace or erase an existing database without reviewing its migration.

## Operational boundaries

Customers, merchants and courier companies register separately. Merchants and courier companies need administrator approval. Merchants maintain their own catalogues; courier companies maintain drivers and service communities. There are no seeded businesses or fake orders.

Cash on delivery only. In-app notifications refresh while the app is open. Card processing, email/SMS order alerts, independent driver login, live GPS and automatic payouts are not connected.

The original hosted site uses a separate identity system and database. Existing hosted user accounts and orders are not migrated by importing this repository. Configure a fresh owner activation secret for this deployment.

See TEST_REPORT.md for executed checks and remaining target-environment integration tests.
