# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TidySnap is an Astro-based static blog website showcasing AI-powered desk organization tips. Deployed on Vercel at https://tidysnap.homes.

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:4321
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
```

## Architecture

- **Framework**: Astro 5.0 with static output
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **Content**: Markdown-based blog posts using Astro Content Collections
- **Analytics**: Google Analytics 4 + Google Ads tracking configured
- **Deployment**: Vercel (connected to main branch)

### Key Directories

- `src/pages/` - Astro pages (index, blog listing, blog posts)
- `src/content/blog/` - Markdown blog posts
- `src/components/` - Reusable Astro components (Navbar, Footer)
- `src/layouts/` - Page layouts
- `public/` - Static assets (images, favicon)

### Blog Content Schema

Blog posts are defined in `src/content.config.ts` with:
- `title`, `description`, `pubDate`
- `heroImage` (optional)
- `tags` (array)
- `author` (default: 'TidySnap Team')

## Environment

- **Domain**: https://tidysnap.homes/
- **GitHub CLI**: Logged in
- **Vercel CLI**: Logged in (deploys from main branch)
- **Stripe CLI**: Logged in
- **API Keys**: Gemini Nano Banana API key stored in `.enc.local` (also available in production)

### Config Files

- `astro.config.mjs` - Astro configuration (site URL, Vite plugins, HTML compression)
- `tailwind.config.mjs` - Tailwind CSS v4 configuration
- `package.json` - Project dependencies and scripts
- `.env.local` - Local environment variables
- `.gitignore` - Git ignore rules
