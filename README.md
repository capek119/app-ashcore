# ashcore

Management Account Automation for Malaysian SMEs — a React SPA that turns bank
transactions into statutory financial statements.

## Running locally with persistence

The app talks to a small local server (`server/`) for persistence: companies,
their full working state, and FS snapshots are stored in a SQLite file
(`server/data/ashcore.db`) instead of only living in memory/localStorage.

Run both processes, in two terminals:

```bash
# Terminal 1 — persistence server (http://localhost:4000)
cd server
npm install
npm run dev
```

```bash
# Terminal 2 — frontend (http://localhost:5173)
npm install
npm run dev
```

Open http://localhost:5173 — you'll land on a company picker. Create a
company or open an existing one; everything you do afterwards (uploads,
classification, subledgers, generated financial statements, snapshots) can be
persisted with the **"Save to server"** button in the header, and snapshots
save automatically when created. Data survives a browser refresh and a
restart of the server process, since it's written to the SQLite file on disk.

The Vite dev server proxies `/api` to `http://localhost:4000` (see
`vite.config.js`); this proxy only applies to `vite dev`/`vite preview` and
has no effect on `vite build` (the GitHub Pages output in `docs/`).

The manual "📂 Load" / "💾 Save" buttons (export/import a `.json` file) still
work as before, independent of the server — useful as a backup/offline
escape hatch.

### Verifying persistence manually

1. Create a company, load the "Sample" data, click "Save to server".
2. Hard-refresh the browser — the same company and data should reload
   automatically (no picker).
3. Stop the server (Ctrl+C in Terminal 1), restart `npm run dev`, refresh the
   browser again — the data should still be there (it's read from
   `server/data/ashcore.db` on disk, not kept in the server process' memory).

### Scope notes

- Persistence is blob-based: a company's working state is stored as one JSON
  blob (reusing the existing save/load-session serialization), not fully
  normalized into SQL tables — see `server/db.js` for the schema and
  rationale. Snapshots get their own table since the UI already lists/
  deletes/versions them individually.
- Only *parsed* transaction data is persisted today, matching what the app
  already keeps after a bank-statement upload — the original uploaded file
  bytes aren't retained anywhere (not by this server, nor previously by the
  app itself).

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
