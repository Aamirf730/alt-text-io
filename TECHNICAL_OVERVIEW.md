# Technical Overview

This document provides technical depth into the architecture, systems, and infrastructure supporting Alt Text Pro.

---

## 🏗️ System Architecture

Alt Text Pro follows a modern serverless architecture:

1.  **Frontend (Next.js 14)**: The user-facing dashboard and landing page, utilizing the App Router and Client Components where necessary for interactivity.
2.  **API Layer (Netlify Functions)**: A robust collection of serverless functions handling business logic, Vision AI calls, and database mutations.
3.  **Database (Supabase)**: PostgreSQL database for user profiles, usage logs, and API key management.
4.  **Auth (Supabase Auth)**: Managed authentication supporting social and password-based login.

---

## 🔑 API Key & WordPress Integration

The project includes an internal API system designed for secure integration with third-party tools like the WordPress plugin.

*   **Key Generation**: Handled via Supabase RPC (`get_or_create_api_key`) in the `api_keys` table.
*   **Validation**: Each request from the WordPress plugin is validated against these keys through a dedicated middleware/function.
*   **Plugin Protocol**: Communicates via standard REST endpoints to trigger bulk alt-text generation and sync results back to the WP Media Library.

---

## 💳 Billing System (Polar.sh)

The billing system is integrated with Polar.sh, supporting multiple tiers:
*   **Tier 1 (Monthly/Annual)**: Basic subscription.
*   **Tier 2 (Monthly/Annual)**: Pro subscription.
*   **Tier 3 (Monthly/Annual)**: Business subscription.
*   **Credit Packs**: One-time top-ups for ad-hoc usage.

All product IDs are managed via environment variables and synchronized with the Supabase `profiles` table.

---

## 🛠️ Infrastructure & Deployment

### Environment Variables (Required)
The following variables must be set in your deployment environment (Netlify):

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for frontend auth |
| `POLAR_ACCESS_TOKEN` | Secret token for Polar.sh SDK |
| `POLAR_WEBHOOK_SECRET` | Secret for verifying payment webhooks |
| `NEXT_PUBLIC_API_BASE` | URL for Netlify functions (relative in prod) |

### Deployment Steps
1.  **Push to main**: Netlify is configured to auto-deploy the root and build the `frontend-next` site.
2.  **Function Discovery**: Netlify automatically detects and builds functions in the `netlify-functions` directory.
3.  **Supabase Migrations**: Apply any pending SQL in the `supabase-migration` folder using the Supabase Dashboard SQL Editor.

---

## 📦 Directory Structure
*   `/frontend-next`: The main Next.js application.
*   `/netlify-functions`: Serverless API logic.
*   `/wordpress-plugin`: The source code for the installable WP plugin.
*   `/supabase-migration`: SQL scripts for database schema setup.
