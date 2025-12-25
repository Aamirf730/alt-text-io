# Alt Text Pro - AI-Powered Image Accessibility

Alt Text Pro is a high-performance, AI-driven SaaS platform designed to automate the generation of accurate, SEO-optimized alternative text for images. Built for accessibility and search engine optimization, it supports over 130 languages and integrates directly with major platforms like WordPress.

---

## 🚀 The Product

### Core Features
*   **AI Alt-Text Generation**: Leverages advanced vision-to-text AI models to understand image context and produce descriptive alt text.
*   **Bulk Processing**: Efficiently handles hundreds of images simultaneously, perfect for large media libraries.
*   **WordPress Integration**: A dedicated plugin that enables direct alt-text synchronization within the WordPress media library.
*   **Multilingual Support**: Supports generation in 130+ languages, catering to global websites.
*   **SEO Optimization**: Craft descriptions that are not only accessible but also optimized for image search rankings.

### The Dashboard
A modern, Next.js 14-powered dashboard allows users to:
*   Manage credits and subscriptions.
*   Perform quick tests with single image uploads.
*   Monitor processing history.
*   Generate API keys for third-party integrations (like the WordPress plugin).

---

## 🛠️ Technology Stack

The project has been modernized to a premium state:
*   **Frontend**: Next.js 14 (App Router), Tailwind CSS, Radix UI.
*   **Backend**: Netlify Functions (Serverless Node.js).
*   **Database**: Supabase (PostgreSQL with Real-time capabilities).
*   **Authentication**: Supabase Auth (Email/Password & Google OAuth).
*   **Payment & Billing**: Polar.sh (Modern, developer-friendly subscription management).

---

## 📖 Essential Documentation

For a deeper dive into specific areas, please refer to:
*   [DEVELOPMENT_PROGRESS.md](./DEVELOPMENT_PROGRESS.md) - Chronological record of the project's development and migration journey.
*   [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) - Detailed technical architecture, API system, and infrastructure setup guide.

---

## ⚡ Quick Start for New Owners

1.  **Environment Setup**: Copy `.env.local.example` to `.env.local` and populate with Supabase and Polar.sh credentials.
2.  **Dependencies**: Run `npm install` in both the root and `frontend-next` directories.
3.  **Local Dev**: Run `npm run dev` in `frontend-next` to start the dashboard, or use `netlify dev` to test the full stack locally.
4.  **Deployment**: Integrated with Netlify for seamless CI/CD.

---

**Alt Text Pro** is built for reliability, accessibility, and scale.
