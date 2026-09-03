# SkillSetu — Vercel deployment

## Recommended GitHub structure
Upload the CONTENTS of this folder to the ROOT of your GitHub repository (not the outer ZIP folder).

The repository root should contain:
- server.js
- package.json
- vercel.json
- api/index.js
- public/index.html
- public/style.css
- public/app.js
- data.json

## Vercel
1. Import the GitHub repository into Vercel.
2. Root Directory: leave it at the repository root (do not select a nested folder if you uploaded the contents here).
3. Framework Preset: Other (or let Vercel detect Express).
4. Build Command: leave empty.
5. Output Directory: leave empty.
6. Install Command: `npm install` (default).
7. Deploy.

## Why this version
- Express is exported for Vercel serverless execution.
- `/` explicitly serves `public/index.html`.
- `/api/*` is routed to the Express function.
- CSS/JS/images remain in `public/` for Vercel static serving.

## Important
`data.json` is demo storage. Vercel serverless functions are stateless and local file writes are not durable production storage. For a production release, use a database.

## Local
`npm install`
`npm start`
Open http://localhost:3000

Direct UI fallback: open `public/index.html`.
