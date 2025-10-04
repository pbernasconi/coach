# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15.5.4 application built with React 19, TypeScript, and Tailwind CSS v4. The project uses the App Router architecture and Turbopack for faster development and builds.

## Key Technologies

- **Framework**: Next.js 15.5.4 with App Router
- **React**: 19.1.0
- **TypeScript**: 5.x with strict mode enabled
- **Styling**: Tailwind CSS v4 with PostCSS
- **Build Tool**: Turbopack (enabled via --turbopack flag)
- **Fonts**: Geist Sans and Geist Mono (loaded via next/font/google)
- **Linting**: ESLint 9 with next/core-web-vitals and next/typescript configs

## Development Commands

```bash
# Start development server (uses Turbopack)
npm run dev

# Build for production (uses Turbopack)
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

The dev and build commands both use the `--turbopack` flag for improved performance.

## Project Structure

- **src/app/**: App Router directory containing pages and layouts
  - `layout.tsx`: Root layout with font configuration and global styles
  - `page.tsx`: Home page component
  - `globals.css`: Global Tailwind CSS styles
- **public/**: Static assets (images, icons, etc.)
- **tsconfig.json**: TypeScript configuration with `@/*` path alias for `./src/*`

## TypeScript Configuration

- Path alias: `@/*` maps to `./src/*` for cleaner imports
- Target: ES2017
- Strict mode enabled
- Module resolution: bundler

## Styling Approach

The project uses Tailwind CSS v4 with the new PostCSS plugin (`@tailwindcss/postcss`). Global styles are defined in `src/app/globals.css` and imported in the root layout. The layout applies font variables using CSS custom properties (`--font-geist-sans` and `--font-geist-mono`).

## ESLint Configuration

Uses flat config format (eslint.config.mjs) with Next.js recommended rules. The configuration extends:
- `next/core-web-vitals`
- `next/typescript`

Ignores: node_modules, .next, out, build, next-env.d.ts
