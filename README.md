# PolarWatch STAC Vue Editor

Vue + Vite app for editing STAC JSON files in the sibling folder `../polarwatch_stac`.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Project Structure
```
polarwatch/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.js
    ├── App.vue
    ├── router.js
    ├── components/
    │   ├── Navbar.vue
    │   └── Footer.vue
    └── pages/
        ├── Home.vue
        └── Stac.vue
```

## What it edits

- Catalog: `../polarwatch_stac/catalog.json`
- Collection files: `../polarwatch_stac/collections/<collection-id>/collection.json`

The app includes local Vite middleware endpoints under `/api/stac/*` that read/write those JSON files directly during development.

## Build

```bash
npm run build
```
