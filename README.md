# DB Browser — Web (Offline) — Final package

This package is a complete client-side DB Browser that runs SQLite entirely in the browser using sql.js (SQLite compiled to WebAssembly).

## What you must do before using
The package **requires** the official sql.js runtime files to run offline:

1. Download these files from https://sql.js.org/
   - `sql-wasm.js`
   - `sql-wasm.wasm`

2. Place both files in the same folder as `index.html` and `app.js`.

## Files included
- `index.html` — main UI
- `app.js` — application logic (open DB, run SQL, view/edit rows, import/export CSV, export DB)
- `README.md` — this file

## Deploy to GitHub Pages
1. Create (or use) a GitHub repository.
2. Add all files (including `sql-wasm.js` and `sql-wasm.wasm`) to the repo.
3. Push to GitHub and enable Pages (branch `main` or `gh-pages`, root).
4. Access your site at `https://<username>.github.io/<repo>/`.

## Notes & limitations
- CSV import assumes first row is header and matches table column names.
- Editing/deleting rows uses primary key (PRAGMA) or falls back to first column equality — be careful with duplicate keys.
- Large DBs or huge imports may be slow due to browser memory limits.

If you want, I can:
- Provide the official `sql-wasm` files bundled into the ZIP for you.
- Create a GitHub Pages branch and give step-by-step git commands to publish.

