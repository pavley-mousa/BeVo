# BeVo — recovered runtime branch

The original editable application files were not present in GitHub. This branch restores a buildable Next.js project around the most recent available production HTML.

## Recovery approach

- `src/public/legacy.html` preserves the rendered HTML captured from the last known-good BeVo production deployment.
- `src/next.config.ts` keeps the browser runtime working by proxying versioned Next.js static assets to the immutable deployment URL: https://bevo-tasker-pr5cq1qsg-bavlymosa37-4178.vercel.app
- `src/public/icon.svg`, `manifest.webmanifest`, and `sw.js` were also recovered from the deployment.
- The project is kept on `recovery-live-runtime` so it can be tested as a preview before changing the production branch.

## Limitation

This is a **runtime recovery bridge**, not the original editable React/TypeScript components. The compiled runtime remains hosted on the pinned Vercel deployment. Do not delete that deployment until the frontend is fully rebuilt into source components and verified.

## Next restoration work

Reconstruct editable pages/components from the recovered running behavior, replace the HTML rewrite with real App Router routes, then remove the external static-asset rewrite. Keep Supabase service-role secrets out of all browser-side files.
