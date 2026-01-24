Phase 5 - Licensing, Trials, and Billing

Goals
- Introduce user licensing tiers and per-user pricing.
- Support free trials with clear limits and conversion flow.
- Provide billing and subscription management for admins.

Planned Outcomes
- License plans (free, trial, paid) with seat limits.
- Trial rules, usage caps, and upgrade prompts (define at Phase 5 kickoff).
- Per-user pricing model with monthly/annual options.
- Admin billing portal with invoices and payment methods.
- Usage metrics to enforce limits and plan eligibility.

Scope Notes
- Define plan policies at Phase 5 kickoff: seat limits, meeting duration, recording limits, AI usage limits.
- Keep audit logs for licensing changes and billing events.
- Ensure compliance for payment data; avoid storing raw card data.

Backend Tasks
- Add org/account model if not present.
- Add license and subscription tables.
- Add usage tracking and enforcement middleware.
- Integrate payment provider (e.g., Stripe) and webhook handling.
- Add admin endpoints for plan changes and trial management.

Frontend Tasks
- Pricing and plan selection pages.
- Trial activation and upgrade flow.
- Account/billing settings in admin dashboard.
- Usage and limits indicators in UI.

Acceptance Criteria
- Admin can start a trial, view expiry, and upgrade to paid.
- Seat limits enforced at join/invite time.
- Billing history and invoices visible to admin.
- Trial and plan changes are audited.
