# Vendored flag artwork

Native **1:1 (square)** country flag SVGs from
[flag-icons](https://github.com/lipis/flag-icons) by Panayiotis Lipiridis,
MIT licensed (see `LICENSE` in this folder).

They're vendored rather than installed so the game keeps working offline with
no CDN or runtime dependency, and so only the 18 flags this dataset needs get
shipped instead of all 271.

Files are named by the dataset's own country code (`ind.svg`, `sa.svg`, …),
not the ISO code, so `Flag.tsx` can map them directly.

Two dataset entries have no flag to source and are drawn in `Flag.tsx`
instead: **WI** (West Indies) and **EAF** (East Africa) are composite cricket
sides, not states.

## Re-vendoring / adding a nation

```bash
npm i --no-save flag-icons
cp node_modules/flag-icons/flags/1x1/<iso>.svg src/assets/flags/<CODE>.svg   # lowercase filename
npm uninstall flag-icons --no-save
```

Then add the code to `src/engine/countries.ts`. `npm test` fails if a nation in
the dataset has no flag, if a flag exists for an unknown code, or if any
vendored SVG isn't square.
