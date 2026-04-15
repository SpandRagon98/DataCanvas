# DataCanvas

DataCanvas is a lightweight BI + editable planning web app built with React, Tailwind, Zustand, Recharts, SheetJS, and AG Grid.

## What is included

- Excel / CSV upload
- Sheet selection for workbooks
- Data preview
- Type detection
- Field pane with dimensions and measures
- Drag-and-drop visual builder
- Global filters
- Multiple visuals
- Editable AG Grid data table
- GitHub Pages deployment workflow

## Local setup

```bash
npm install
npm run dev
```

## Production build

```bash
npm install
npm run build
```

## GitHub Pages deploy

1. Create a GitHub repository.
2. Upload the full project contents.
3. Push to the `main` branch.
4. In GitHub, go to **Settings > Pages**.
5. Set source to **GitHub Actions**.
6. The included workflow at `.github/workflows/deploy.yml` will build and deploy automatically.

## Important note

This version uses `HashRouter`, which avoids refresh errors on GitHub Pages project sites.
