# PolarWatch Website Redevelopment

The PolarWatch website has been redeveloped using the Vue.js framework.

The build process generates static HTML pages, which are stored in the `dist/` directory (and `docs/` for GitHub Pages deployment), along with supporting asset directories such as `css/`, `js/`, and other resources.

This git repository is set up so that any changes to the main branch will trigger build process.  

To host the website, copy all contents of the `dist/` directory to the web server.

# PolarWatch STAC Vue Editor

Vue + Vite app for editing STAC JSON files in the  folder `../stac`.
**Notes** This is for developers to build the Vue application

## Run

```bash
npm run dev

```

Open `http://localhost:5173`.

## Project Structure
```
polarwatch/

```

## What it edits

- Catalog: `../stac/catalog.json`
- Collection files: `../stac/collections/<collection-id>/collection.json`

The app includes local Vite middleware endpoints under `/api/stac/*` that read/write those JSON files directly during development.

## Build

```bash
npm run build
```

## Preview 
```bash
npm run preview # to check the built copy
```
