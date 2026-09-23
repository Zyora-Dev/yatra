# Yatra

A domestic and international travel companion with destination discovery, approximate GPT-4.1 budgets, account access and Trip Together group planning. Yatra never processes payments or claims live booking availability.

- Frontend: Next.js, React, Tailwind CSS and shadcn/ui.
- Backend: FastAPI and PostgreSQL, Google Places and Azure OpenAI GPT-4.1.
- Deployment: [Render setup, environment values and verification](DEPLOY_RENDER.md).
- Backend: [Local setup and API documentation](backend/README.md).
- Project: [Confirmed context](CONTEXT.md) and [progress and known limitations](PROGRESS.md).

For local frontend development, run `npm ci` and `npm run dev` from `frontend/`. Follow the backend guide for the separate API and database. Keep credentials in ignored local environment files or your hosting provider's secret settings. Never commit `.env`, private keys, database dumps or traveller records.