# Yatra Project Context

Last updated: 2026-09-23

## Project Identity
- Working name: Yatra, based on the workspace name; final branding is not yet confirmed.
- Problem statement title and description supplied by the user: "Student Innovation-A solution/idea that can boost the current situation of the tourism industries including hotels, travel and others."
- Category: Software.
- Theme: Travel & Tourism.

## Confirmed Direction
- User approved nearby railway stations, bus stops/terminals and routes displayed inside Yatra. Extend Getting around worldwide; use Google Routes for driving, walking and available public-transit instructions between selected places. No live vehicle tracking, guaranteed schedules, fares, booking or payments. An embedded map is not part of this first route-results implementation.
- Country- and state-level searches should show tourist attractions throughout the selected region without a radius filter or requiring a different destination. This is a worldwide rule, not specific to the user's Goa example. City and landmark searches retain nearby discovery; selecting a regional attraction can open its nearby places. Results remain sourced and non-exhaustive.
- User requested restaurant details for a selected location. Add restaurant discovery to the existing worldwide category/radius search and sourced place-details flow; no menus, prices, availability or booking integration assumed.
- User selected `https://github.com/Zyora-Dev/yatra.git` for the project commit and requested Render deployment preparation and guidance. Render is the confirmed hosting target; paid resource creation, public launch and local-data migration have not been performed or separately approved. The Blueprint's Singapore region and small paid compute plans are editable preparation defaults, not approved spending.
- User approved Trip Together and requested a menu entry: account-based shared trips, private individual spending/pace/interests/must-have submissions, a shared compromise outline and a fairness check with one adjustment. Initial matching is deterministic; no new AI or data provider is required. Invite-based participation is approved for this feature; payments and booking remain excluded.
- User approved the proposed trip feasibility feature: assess available time, spending and travel pace, highlight conflicts or unknowns, and offer one practical adjustment. Initial implementation reuses existing budget estimates with explicit user-entered timing; no new route, weather or accessibility provider is assumed approved or available.
- Do not use hackathon/event branding anywhere in the product or project descriptions. Signed-in users should see Dashboard instead of Sign in, with a small dashboard for existing account and travel features.
- Latest approved changes: GPT-4.1 provides explicitly approximate destination-based budget ranges from traveller count and trip duration, with editable amounts. Hero and collections should mostly feature Indian tourism (including Jammu, Darjeeling, Varkala and Goa); add six featured pilgrimage destinations with other places searchable. International search remains available.
- Build an AI-based travel and tourism companion, going beyond a basic tourism directory.
- Cover domestic and international travel, not only local tourism or Tamil Nadu.
- Provide AI travel suggestions, hotel details, temples, churches, other places to visit, and location-based recommendations.
- Support personalised trip planning around traveller preferences, budget, interests, and location.
- Yatra NEVER processes payments. This is a permanent product boundary, not a feature postponed to a later phase.

## Discussed, Not Yet Individually Approved
- Saved trips, account-linked favourites, itinerary export, and sharing. Basic registration/login is now approved below.
- Embedded maps, weather-aware replanning, and offline access. Transport discovery and in-app route results are now approved above.
- Multilingual assistance, currency information, and international travel guidance.
- Business listings, enquiries, business dashboards, and administration.
- These are candidate capabilities from discussion, not an implementation mandate or completed functionality.

## Open Decisions
- Whether a separate mobile app will follow the responsive website.
- Additional external data providers. Azure OpenAI GPT-4.1 is the confirmed LLM; Google Places and Azure live integration are authorised.
- Hotel enquiry or outbound-link behaviour; no booking integration has been approved.
- API budget, Render resource sizes/region and public-launch readiness, and the verified dataset used for demonstrations.
- Any limited demo dataset must be labelled honestly without changing the global product scope.

## Information Quality
- Ground factual recommendations in reliable data and distinguish facts from AI suggestions.
- Clearly label estimates, stale information, missing data, and demonstration content.
- Do not claim live hotel prices, availability, or global data coverage without supporting integrations.
- International entry requirements need current official sources and traveller-specific context, not unsupported AI assertions.

## Current Authorised Task
Build an animated, elegant dark homepage with location search in the user-created frontend directory. The user grants design freedom within the confirmed scope.
- Previous milestones: add Sign in before Let's explore in the header; install Python/FastAPI in backend/ and run the local backend on port 8800.
- New confirmed task: create PostgreSQL database yatra with a users table; registration collects email, WhatsApp number, password, and location. Login accepts email or WhatsApp number plus password. Connect registration/login forms to the homepage Sign in button. WhatsApp is a stored phone number, not OTP verification.
- Subsequent confirmed direction: destination-centred results with category/filter selection, nearby tourist spots, hotels and travel services, available contact details, a budget calculator, and grounded LLM suggestions. This discussion does not authorise implementing all of those features yet.
- Current task: add local environment fields for Google Maps API keys. API enablement/billing happens in Google Cloud, not in environment files. No live Google integration is included in this task.
- Subsequent task: add backend environment variables for Azure OpenAI GPT-4.1. Configuration only; no model deployment or LLM integration authorised by this request.
- Latest authorisation: test configured Google Places and Azure GPT-4.1 credentials, then proceed with destination search and suggestion integration. Provider access must work before live end-to-end verification; no payment or deployment scope added.
- After both access checks passed, the user requested implementation with elegant, vibrant shadcn/ui components. Connect destination results, category/radius selection, available details, estimate-based budget and grounded GPT-4.1 suggestions within the existing design.

## Confirmed Stack and Design
- User requested a more elegant homepage footer with lists and hotel names; this is discovery/navigation content, not a booking integration.
- Backend: FastAPI; minimal local server on port 8800 authorised after the homepage milestone. Python environment is the workspace .venv.
- Frontend: Next.js, Tailwind CSS, and shadcn/ui components.
- Typography: Inter.
- Theme: dark, with elegant vibrant purple/violet and pink accents. Earlier light, teal, and cherry proposals are superseded.
- First milestone: responsive homepage with working local destination search, clearly distinguished from future live place data and AI integrations.