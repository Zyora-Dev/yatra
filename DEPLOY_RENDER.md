# Deploy Yatra on Render

## Architecture and Cost

Use the root `render.yaml` Blueprint from `https://github.com/Zyora-Dev/yatra.git`.

| Resource | Runtime | Access | Default compute |
| --- | --- | --- | --- |
| `yatra-web` | Node 24, Next.js | Public HTTPS | 0.5 CPU / 512 MB |
| `yatra-api` | Python 3.13.14, FastAPI | Private Render network only | 0.5 CPU / 512 MB |
| `yatra-db` | PostgreSQL 17 | Private network only | 0.1 CPU / 256 MB |

These are **paid** resources, all in Singapore. Review Render's current price estimate before creating them; no services have been provisioned by preparing this repository. Region and instance sizes are editable defaults, not measured capacity recommendations. Increase memory if runtime metrics show pressure. Keep all three resources in the same region. Free hosting is not a drop-in replacement for this private-service/pre-deploy setup, and expiring free databases are inappropriate for persistent traveller accounts.

The frontend must be a **Node web service**, not a Static Site. Browsers call same-origin `/api/*`; Next.js proxies to the private API. Provider keys and database credentials belong only to the API. Local accounts and trips are **not** uploaded: Render starts with a new empty database. Saved favourites are browser-local and will not transfer from localhost to the deployed domain.

## First Deployment

1. Sign in to [Render](https://dashboard.render.com), connect GitHub and grant its GitHub app access to `Zyora-Dev/yatra`. For an organization/private repository, an organization administrator may need to approve access.
2. Select **New > Blueprint**, choose this repository and its committed branch, and use `render.yaml` at the repository root. Review the preview for exactly two services and one database. If those resource names already exist in your workspace, stop and use unique names consistently throughout the Blueprint rather than adopting an unrelated resource.
3. Enter the prompted environment values from the table below directly in Render. Never paste credentials into chat, Git, screenshots or frontend variables.
4. For `TRUSTED_ORIGINS`, use your known final frontend origin. If you do not yet know the generated Render URL, initially use `https://setup.invalid`, which deliberately allows no real browser origin. Do not guess that the URL will match the service name.
5. Review charges and select **Deploy Blueprint**. The API installs pinned dependencies, runs `python apply_schema.py`, then starts Uvicorn. The database is wired automatically. The frontend uses the API's actual private `hostport` property during its production build.
6. Copy the **actual HTTPS URL** shown on `yatra-web`. On `yatra-api > Environment`, replace `TRUSTED_ORIGINS` with that exact origin (scheme and host, no trailing slash/path). Save and redeploy the API. Login and other writes will be blocked until this is correct.
7. Check both service deploy logs and complete the verification checklist below before sharing the site. Automatic deploys are initially **off**; a future Git push alone will not deploy code.

## Environment Values

| API variable | Value |
| --- | --- |
| `TRUSTED_ORIGINS` | Exact frontend HTTPS origin; multiple origins comma-separated, **no spaces** or trailing slashes |
| `GOOGLE_MAPS_API_KEY` | Server-side key restricted to Places API (New), with billing/API access enabled |
| `AZURE_OPENAI_ENDPOINT` | Existing configured Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | Existing resource key |
| `AZURE_OPENAI_DEPLOYMENT` | Exact existing GPT-4.1 deployment name, not an assumed model ID |
| `AZURE_OPENAI_API_VERSION` | The version already verified with your existing deployment |
| `AZURE_OPENAI_MODEL` | Blueprint sets `gpt-4.1`; model choice is unchanged |
| `DATABASE_URL` | Automatically supplied from Render Postgres; do not use localhost |
| `COOKIE_SECURE` | Blueprint sets `true`; keep it enabled for HTTPS |

The remaining runtime values (`PYTHON_VERSION`, `PORT`, frontend `NODE_VERSION` and `BACKEND_HOSTPORT`) are provided by the Blueprint. Do not manually replace the generated private hostname. `BACKEND_URL` is set explicitly by the frontend build/start commands, because Next.js rewrites are captured at build time. If the API address changes, rebuild the frontend; a runtime-only change is insufficient. Do not add any provider secret using a `NEXT_PUBLIC_` prefix. The optional local browser Google key is unused by the current application and is not needed on Render.

Configure provider network restrictions to permit the backend's Render outbound traffic. Check the service's displayed outbound addresses rather than assuming your local IP restrictions will work. Keep provider quotas and spending alerts enabled. Existing provider access must be allowed from Render; successful local calls do not prove deployed connectivity. Rotate the Google key previously exposed during local setup if that has not already been done.

`sync: false` values are prompted during initial Blueprint creation only. Add/change later secrets directly on the API's Environment page and redeploy. Never upload local `.env` files or commit a database URL containing credentials.

## Build and Start Commands

These are already in the Blueprint. Commands run relative to each service's **Root Directory**.

| Setting | Frontend (`frontend`) | Backend (`backend`) |
| --- | --- | --- |
| Build | `npm ci --include=dev && BACKEND_URL="http://$BACKEND_HOSTPORT" npm run build` | `pip install -r requirements.txt` |
| Pre-deploy | None | `python apply_schema.py` |
| Start | `BACKEND_URL="http://$BACKEND_HOSTPORT" npm run start -- --hostname 0.0.0.0 --port $PORT` | `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1 --no-proxy-headers` |
| Health | `/` | Private `/health` for manual process checks |

Schema setup uses the configured database role, one transaction and `CREATE ... IF NOT EXISTS`. Failure stops deployment without intentionally deleting existing rows. It requires `DATABASE_URL` explicitly and does not load a local `.env`. It is initial/additive setup, **not** a migration engine for changed column definitions. Future schema changes need reviewed, versioned migrations and backups. Do not run tests against the production database: integration tests need schema-creation permission and are intended for a disposable test database.

Uvicorn does not trust arbitrary forwarded client-IP headers. Existing throttles therefore remain shared by traffic through the frontend proxy. Increasing worker count does not fix this and would fragment limits further.

## Verification

1. Render shows both application deployments successful. From the API's Render Shell, run `curl --fail http://127.0.0.1:10000/health`; expect `{"status":"ok"}`. This is a process check, not a database/provider readiness check.
2. Open the actual frontend HTTPS URL. Check `/`, `/explore` and `/together`; verify local photos and navigation load on mobile as well as desktop.
3. In a fresh browser, `/api/auth/me` should return **401**, not a proxy 502, HTML 404 or redirect. Register a dedicated QA account through the UI; verify reload persistence, logout and login. Inspect the session cookie in browser DevTools: `HttpOnly`, `Secure`, `SameSite=Lax`.
4. Search one domestic and one international city. Open details/photos and generate one GPT-4.1 shortlist/budget. Confirm provider logs/quotas and attribution rendering. These actions can incur provider usage charges.
5. With two separate QA accounts/browser profiles, create/join a group, save each person's preferences, verify that raw answers are visible only to their author, check the shared draft, withdraw, rotate/revoke an invite and delete the test group. Do not delete real traveller records.
6. Inspect API/frontend logs for errors and monitor memory/latency. A green `/` health check alone does not validate auth, database access or provider connectivity.

## Common Failures

| Symptom | Check |
| --- | --- |
| Build cannot find `package.json` or `requirements.txt` | Correct Root Directory for each service |
| Schema pre-deploy fails | Database is available, correct internal connection is injected, role has DDL permissions; do not reset the database |
| API proxy 502 | API deploy/start logs, matching region/private network and generated `BACKEND_HOSTPORT`; rebuild frontend after address changes |
| Writes return 403 | Exact browser origin is in API `TRUSTED_ORIGINS`, no spaces/trailing slash; API redeployed after change |
| Login returns 503 | Database/schema connection failure; inspect API logs before changing CORS |
| Session will not persist | Use HTTPS and same-origin `/api/*`; keep secure cookies and avoid cross-origin direct API calls |
| 429 across multiple users | Current shared process-local throttles; do not disable protection to hide the problem |
| Search/AI returns provider errors | Correct server-side keys, API/deployment/version, quotas and outbound-network restrictions |
| Fonts fail during build | Next.js font download requires build-time network access; inspect build log |

## Custom Domain

Add the domain to `yatra-web > Settings > Custom Domains`, then apply the DNS records **Render actually supplies**. Wait for domain verification and HTTPS certificate issuance. Add the new HTTPS origin to API `TRUSTED_ORIGINS`, retaining the generated origin only if it should remain usable. Redeploy the API and repeat the session/write checks. Users need to sign in again on the new domain; cookies are host-specific. Never weaken origin checks to `*`.

## Updates, Backups and Rollback

Before production changes, verify database backup/recovery availability for your chosen Render plan and take an appropriate backup. Do not assume the local database is a backup of hosted data. Test restoration into a separate database; never overwrite production merely to test a backup.

After pushing a reviewed commit, manually deploy the API first when it changes, inspect pre-deploy/start logs, then deploy the frontend and repeat smoke checks. Coordinate changes so the old frontend still works while the API rolls out. You can enable automatic deployments later after setting up appropriate checks.

For an application regression, use Render's rollback/redeploy controls to return the affected service to a known-good compatible commit. A code rollback does **not** reverse database changes. Use forward-compatible additive migrations and a separately reviewed database recovery plan. Never delete/recreate `yatra-db` as a deployment fix.

## Public-Launch Limitations

This prepares hosting; it does not certify the app for an unrestricted public launch. Before broad traffic, address shared/distributed abuse throttling with trusted client-IP handling, enforce provider spending controls, review Google content/photo licensing and attribution requirements, document privacy/retention/deletion practices, and decide account recovery/contact verification requirements. Those changes are not implemented by this deployment setup. Trip Together protects raw answers through application access control, but derived results can reveal constraints. Travel budgets and shared activity themes remain unverified estimates/drafts. Yatra never processes payments.

## Reference

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Next.js on Render](https://render.com/docs/deploy-nextjs-app)
- [FastAPI on Render](https://render.com/docs/deploy-fastapi)
- [Render pricing](https://render.com/pricing)

Local verification: production Next.js build passed and all four compiled API rewrites used the explicit private proxy target; schema runner checked without modifying a database. Staged files passed a targeted value-free credential/artifact scan. The Blueprint parsed locally, but the installed JSON Schema validator does not support Render's current 2020-12 draft. Render's Blueprint validation, Linux/Node 24 execution, deployed private-network reachability, database initialization and live HTTPS/provider checks remain to be performed on Render.