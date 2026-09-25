# Yatra Backend

FastAPI development server using Python 3.13, PostgreSQL, and the workspace's existing `.venv`.

## Database

The local `yatra` database already exists with `users`, `sessions`, `together_trips` and `together_members` tables. The default connection is `postgresql:///yatra`, using the current operating-system role over a local socket. No credentials are committed.

For a new installation only, create the database once, then apply the schema. Do not recreate or delete an existing database:

```sh
psql -X -w -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE yatra'
psql -X -w -d yatra -v ON_ERROR_STOP=1 -1 -f backend/schema.sql
```

The schema is idempotent for initial creation; it does not migrate existing column definitions. Future schema changes need explicit migrations.

For an existing installation adding Trip Together, run only the schema-application command above. Its new tables and index are additive; existing users and sessions are preserved.

## Run

Run from the workspace root:

```sh
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8800 --reload --reload-dir backend
```

Alternatively, run the VS Code task `Yatra backend`.

- Health: http://127.0.0.1:8800/health
- API documentation: http://127.0.0.1:8800/docs
- OpenAPI schema: http://127.0.0.1:8800/openapi.json

## Authentication

- `POST /auth/register`: `email`, `whatsapp`, `password`, `location`. Passwords are 15-128 characters; WhatsApp must be a valid international number including `+` country code. Registration signs in automatically.
- `POST /auth/login`: `identifier` (email or WhatsApp number), `password`.
- `GET /auth/me`: current profile, or 401 for missing/expired sessions.
- `POST /auth/logout`: revoke the current session and clear its cookie.
- Every POST requires `X-Yatra-Request: 1`. Browser origins must be explicitly trusted. Use the Authorize-independent cookie session in API clients, not bearer tokens.
- Profiles never return password hashes. Email is normalized to lowercase, phone numbers to E.164. Passwords use Argon2id; only SHA-256 digests of random session tokens are stored. Sessions expire after seven days and rotate at login.
- The frontend calls `/api/auth/*` on its own origin; Next.js forwards these requests to this backend. No cross-origin CORS access is enabled.

Startup loads `backend/.env` before importing routers. Existing process environment values take precedence:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql:///yatra` | PostgreSQL connection |
| `TRUSTED_ORIGINS` | localhost and 127.0.0.1 on ports 3000 and 8800 | Comma-separated allowed browser origins, without trailing slashes |
| `COOKIE_SECURE` | `false` | Set to `true` when using HTTPS |
| `BACKEND_URL` (Next.js environment) | `http://127.0.0.1:8800` | Server-only proxy target; restart/rebuild Next.js after changing |

The server binds to localhost for development. There is no email/WhatsApp ownership verification, OTP, password reset, or account editing. Local authentication throttling is per process and socket peer (20 attempts per 15 minutes); traffic through Next.js shares the proxy address. A public deployment needs HTTPS, restricted origins, dedicated DB permissions, and shared throttling with trusted client-IP handling. Render hosting configuration is provided in [the deployment guide](../DEPLOY_RENDER.md); no hosted deployment has been performed.

## Google API Keys

- `backend/.env`: `GOOGLE_MAPS_API_KEY` for server-side Places and Routes requests. Keep this key private and restrict it to Places API (New) and Routes API.
- `frontend/.env.local`: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for the browser map. Use a separate key restricted to Maps JavaScript API and allowed website referrers. Public-prefixed values are visible in browser code.
- Both files match existing Git ignore rules. Never commit or paste key values into chat.
- Enable billing and the required APIs in Google Cloud: Places API (New) and Routes API. Maps JavaScript API is only needed for a future embedded map. Environment variables do not grant API access; route computations incur provider usage charges and need quotas/spending alerts.
- The current destination UI uses server-side Places/Routes calls, in-app route instructions and optional external Google Maps links. It does not use the optional browser key or an embedded Maps JavaScript canvas.

## Azure OpenAI Configuration

The selected LLM is Azure OpenAI GPT-4.1. Backend-only fields in `backend/.env`:

- `AZURE_OPENAI_ENDPOINT`: your Azure OpenAI resource endpoint.
- `AZURE_OPENAI_API_KEY`: your resource key; keep private.
- `AZURE_OPENAI_DEPLOYMENT`: the exact deployment name in Azure, which may differ from the model name.
- `AZURE_OPENAI_API_VERSION`: the supported version for the versioned API used during integration; a v1 client does not require a dated API version.
- `AZURE_OPENAI_MODEL`: `gpt-4.1`, the confirmed model selection.

The configured deployment is called through the versioned chat-completions HTTP API. Google and Azure access have been verified locally. No Azure resources are created or deployed by this application.

## Travel API

Next.js forwards `/api/travel/*` to `/travel/*`. POST requests require the same header and trusted-origin checks as authentication, but travel discovery does not require a login.

| Endpoint | Input | Result |
| --- | --- | --- |
| `POST /travel/destinations` | `query` (2-160 characters) | Up to five Google destination matches |
| `POST /travel/region-destinations` | Country/state `place_id` | Region and up to 20 Google tourist attractions, filtered by country/state address components; no radius |
| `POST /travel/nearby` | `place_id`, `category`, `radius_km`, optional `transport_kind` | Destination and up to 12 nearby places |
| `POST /travel/routes` | `origin_place_id`, destination `place_id`, `mode` (`DRIVE`, `WALK`, `TRANSIT`; default `DRIVE`) | `{routes: [...]}` with localized distance/duration, warnings and leg steps; empty list when no route is found |
| `POST /travel/details` | `place_id` | Available address, contact, website, hours and ratings |
| `GET /travel/photo` | `name` (validated Google photo resource) | Redirect to a Google-hosted image; no API key exposed |
| `POST /travel/suggestions` | Nearby input plus `preferences` (3-800 characters) | Up to four GPT-4.1-selected places from server-retrieved candidates |
| `POST /travel/budget` | `place_id`, `days` (1-60), `nights` (0-59), `travellers` and `rooms` (1-30), `currency`, `style` | Approximate GPT-4.1 unit-cost ranges and deterministic group/per-person totals |

Categories are `sights`, `stays`, `restaurants`, `spiritual`, and `transport`. Restaurants use Google's restaurant type and the same available contact, website, hours, ratings and Maps details. Radius is 1-50 km around a selected city, neighbourhood or landmark. Country and first-level administrative-area selections use region discovery instead: attractions throughout the region without radius controls. The nearby endpoint still rejects regional centres. Region membership requires matching Google address components; missing components are excluded rather than guessing containment. Google text search is not an exhaustive geographic catalogue, so results can be sparse or empty. No country/state names are hardcoded. Selecting a regional attraction opens nearby discovery, and changing destination restores the region results.

Transport filters are `all` (default), `rail` (train, light rail and subway stations), `bus` (stops and terminals), and `services` (agencies, car rentals and taxi stands). The filter only applies to the transport category; transport results are ranked by distance and limited to 12 within the selected radius. Suggestions use the same selected filter.

Routes require distinct Google place IDs for specific places or cities; country/state endpoints are rejected. Yatra displays instructions inside its route dialog, including operator attribution and transit stops/times when supplied. Transit departure defaults to now; driving duration is estimated without live traffic. Provider coverage varies, particularly for transit. No embedded route map, navigation tracking, live vehicle locations, fares, guaranteed schedules or reservations are provided. Routes are computed on request, not saved. The server resolves both endpoints and calls Google Routes with an explicit field mask; raw provider errors and the API key are never returned.

Google fields are explicitly requested, provider URLs sanitized, and raw provider failures hidden. Photos display author attribution. Google content is not persistently stored. AI shortlist output is restricted to known candidate IDs; it cannot add place facts, prices or availability.

Budget estimates separately use GPT-4.1 with a Google-resolved destination and trip inputs. Validated finite, nonnegative low/high ranges cover stay per room/night, food per person/day, transport for the group/day and activities per person/trip. Totals use deterministic arithmetic. The planner suggests days minus one nights and one room per two travellers; both are adjustable. Styles are budget/comfort/premium; currencies are INR/USD/EUR/GBP/JPY/AED/SGD/AUD. Changing currency generates a new estimate, not an exchange-rate conversion. Estimates are approximate, not accurate/live prices or availability. Journey costs, visas, insurance, shopping and extra taxes are excluded from suggested ranges; journey costs can be entered manually. Editable midpoint amounts persist across planner tabs. Budget and shortlist requests share the AI throttle.

Travel requests are limited per process and socket peer to 120 Places requests, 20 route computations and 8 AI requests per five minutes. Photo requests count toward the Places limit. These limits are shared behind the local proxy, not production-ready distributed abuse or spending controls. Public deployment, API spending controls, provider-policy review and browser Maps access remain outside this local implementation.

## Trip Together

The `/together` frontend uses the existing cookie session through `/api/together`. All routes require authentication. All writes require `X-Yatra-Request: 1` and a trusted browser origin. Writes share the existing process-local authentication throttle of 20 requests per socket peer per 15 minutes, including traffic behind the Next.js proxy; this is a local-development limit, not a production collaboration rate limiter.

| Endpoint | Behaviour |
| --- | --- |
| `GET /together` | List the current user's groups |
| `POST /together` | Create with title, destination, display alias, days, currency and optional proposed per-person cost |
| `POST /together/join` | Join using an invite code and unique display alias |
| `GET /together/{id}` | Member-only group, own raw preferences and shared draft |
| `PUT /together/{id}` | Owner changes duration and proposed per-person cost |
| `PUT /together/{id}/preferences` | Save only the current member's budget, pace, interests and must-haves |
| `DELETE /together/{id}/preferences` | Withdraw only the current member's answers |
| `POST /together/{id}/invite` | Owner issues a new code, invalidating the previous one |
| `DELETE /together/{id}/invite` | Owner revokes the code; existing members remain |
| `DELETE /together/{id}` | Owner deletes the group; another member leaves and removes their own answers |

Groups allow 1-14 days, 12 members and 20 memberships per account. Currency is fixed at creation; amounts are not converted. Codes are random, valid for seven days and stored only as hashes. Anyone signed in with a valid code can join. The raw code is returned only on issuance, never placed in a URL. Group responses do not expose other members' raw answers, contact details or user IDs. Shared themes, aliases, coverage and budget-fit results can indirectly reveal preferences or spending constraints, especially in small groups or after repeated changes to the proposed cost. This is application-level access control, not end-to-end encryption or inference-proof privacy.

The deterministic draft requires at least two members and every member's submission. It selects activity themes, optional afternoon splits, the gentlest requested shared pace, selected-interest coverage and one prioritised adjustment. Each traveller receives at most one theme credit per block. Coverage is not satisfaction, and must-haves are checked rather than guaranteed. No real venues, route durations, hours, availability, accessibility, prices or safe separation arrangements are verified. Shared costs are entered estimates; no AI calls, new providers or payments are involved. Use Refresh to retrieve other members' changes; there is no real-time synchronization.

## Tests

```sh
.venv/bin/python -m unittest discover -s backend -p test_auth.py -v
.venv/bin/python -m unittest discover -s backend -p test_travel.py -v
.venv/bin/python -m unittest discover -s backend -p test_together.py -v
```

Authentication and group integration tests create random `auth_test_*` or `together_test_*` schemas inside the configured database, use those schemas exclusively, and drop only those test schemas afterward. The PostgreSQL role must have schema-creation permission. Application users are not modified by these tests. Group tests cover member isolation, private submissions, invite rotation/revocation/expiry, withdrawal, leave/delete, CSRF, input validation, deterministic fairness and one-activity-per-split credit. The test client currently emits a Starlette deprecation warning for httpx; the tests pass.