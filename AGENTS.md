# Repository Guidelines

## Project Structure & Module Organization

The application is a React 19 + TypeScript frontend built with Vite:

- `src/views/` contains dashboard, transactions, budgets, assets, analysis, and settings screens.
- `src/components/` contains shared UI; `src/lib/` contains finance calculations, storage, and exports.
- `src/types.ts`, `src/data.ts`, and `src/store.ts` define the model, demo data, and persistence.
- `electron/` provides the desktop wrapper; `macos/` and `scripts/` contain the native macOS shell and packaging scripts.
- `tool/parse_cmb_pdf.py` converts China Merchants Bank text PDFs to CSV. `example/` holds sample input; generated files belong in `tool/output/`.
- Tests live beside the code they cover, currently in `src/lib/finance.test.ts`.

## Build, Test, and Development Commands

Use Node.js 20+ and pnpm:

```bash
pnpm install                 # install dependencies
pnpm dev                     # start Vite on 127.0.0.1
pnpm test                    # run Vitest once
pnpm build                   # type-check and create dist/
pnpm preview                 # serve the production build locally
npm run electron:dev         # build and launch Electron
npm run package:desktop      # create a desktop installer in release/
```

On macOS, `npm run build:mac` creates `dist-mac/清算.app`; `npm run package:mac` also creates a DMG. For PDF conversion, create the documented `qingsuan-pdf` Conda environment and run `conda run -n qingsuan-pdf python tool/parse_cmb_pdf.py <input.pdf>`.

## Coding Style & Naming Conventions

Use strict TypeScript with two-space indentation, semicolons, single-quoted strings, and trailing commas where used nearby. Prefer small functional React components and existing helpers. Use `PascalCase` for components, `camelCase` for functions, variables, and hooks, and `kebab-case` for asset names. No formatter or linter is configured; run `pnpm build` to catch type errors.

## Testing Guidelines

Vitest is the test framework. Name files `*.test.ts` or `*.test.tsx`, keep them near implementation, and describe behavior with `describe`/`it`. Add focused tests for finance calculations, persistence transformations, and export formats when changing them. Run `pnpm test`; no coverage threshold is configured.

## Commit & Pull Request Guidelines

Use short imperative Conventional Commit-style subjects such as `feat:`, `fix:`, and `docs:`; add `[skip ci]` only when intentionally avoiding CI. Keep commits focused. Pull requests should explain the user-visible change, list validation commands, link any issue, and include screenshots or a short recording for UI changes. Mention packaging or data-format compatibility impacts.

## Security & Data Handling

Data is stored in browser `localStorage` and is not uploaded automatically. Do not commit real statements, generated exports, credentials, or secrets. Use the sample PDF for parser work, and export a JSON backup before changing persistence formats.
