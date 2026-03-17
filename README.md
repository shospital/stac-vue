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
