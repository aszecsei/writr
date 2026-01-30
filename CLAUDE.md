# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (starts on localhost:3000)
- **Build:** `npm run build`
- **Start production:** `npm run start`
- **Lint:** `npm run lint` (runs `biome check`)
- **Format:** `npm run format` (runs `biome format --write`)

No test framework is configured yet.

## Architecture

This is a Next.js 16 app using the **App Router** (`src/app/` directory). It uses React 19 with the React Compiler enabled (`reactCompiler: true` in next.config.ts).

- **Styling:** Tailwind CSS v4 via PostCSS. Global theme variables (colors, fonts, dark mode) are defined in `src/app/globals.css`.
- **Linting/Formatting:** Biome (not ESLint/Prettier). Configured with recommended rules plus React and Next.js domains. Uses 2-space indentation.
- **Path alias:** `@/*` maps to `./src/*`.
- **TypeScript:** Strict mode enabled.
