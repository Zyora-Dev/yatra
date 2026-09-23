# Yatra Workspace Instructions

## Start Here
- Read [CONTEXT.md](CONTEXT.md) and [PROGRESS.md](PROGRESS.md) before planning work, editing files, or reporting project status.
- Follow the latest explicit user direction. Record confirmed decisions in CONTEXT.md; do not promote assistant suggestions into approved requirements.

## Scope Boundaries
- Yatra supports domestic and international travel. Do not restrict the product to a local region or silently substitute local-only coverage.
- Yatra never processes payments. Do not propose or implement payment gateways, checkout, payment collection, refunds, or payment-processing roadmaps.
- Do not assume direct reservations, booking-provider integrations, monetisation, a technology stack, or a deployment target have been approved.
- Work on the user's requested task only. Questions and brainstorming do not authorise implementation or additional features.
- Check existing files before creating modules. Keep changes focused and preserve user work.

## Truth and Progress
- Never invent place details, hotel prices, availability, opening hours, visa rules, integrations, or completed work. Distinguish sourced facts, estimates, and demo data.
- After each completed change, update PROGRESS.md with what changed, verification performed, and unresolved blockers. Update CONTEXT.md only when a product decision changes.
- Keep completed, proposed, and pending work separate. Report validation limitations explicitly.
- Keep secrets, credentials, and sensitive traveller data out of documentation and source control.
- Confirmed stack: FastAPI backend; Next.js, Tailwind CSS, shadcn/ui frontend; Inter font; dark violet/pink theme. Inspect actual configuration before giving or running project commands.

## Context Agent
- The [Yatra Context agent](.github/agents/yatra-context.agent.md) maintains context and progress documentation. It does not implement application features or deploy services.