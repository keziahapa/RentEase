# API Gaps & Placeholders

This document tracks backend capabilities that are required by the product requirements but are not present in the current `openapi/rentease.yaml` specification. Frontend features depending on these endpoints should continue to use clearly marked mock data until the APIs are delivered.

## Financial Management (Requirements §2)

Needed for the tenant and landlord financial dashboards.

- `GET /api/tenant/payments` — retrieve paginated payment history (amount, type, method, status, reference, createdAt).
- `POST /api/tenant/payments` — initiate a rent or deposit payment (supporting M-Pesa, bank transfer, card).
- `GET /api/tenant/deposit` — fetch the tenant’s active deposit summary and breakdown.
- `GET /api/tenant/deposit/timeline` — chronological list of deposit events (payments, inspections, refunds).
- `POST /api/tenant/deposit/dispute` — raise a dispute against deposit deductions.

## Secure Deposit Escrow (Requirements §2)

Support for verified vacancy and move-out flows.

- `POST /api/landlord/deposits/{depositId}/release` — release escrow once inspections pass.
- `POST /api/landlord/deposits/{depositId}/hold` — flag deductions with reason codes.
- `GET /api/landlord/deposits` — aggregated status of deposits per property/unit.

## Maintenance & Verified Vacancy (Requirements §§3, 6)

Endpoints required for maintenance requests, caretaker workflows, and the verified vacancy system.

- `POST /api/tenant/maintenance-requests` — submit a new maintenance ticket with attachments and priority.
- `GET /api/tenant/maintenance-requests` — list maintenance requests and their status timeline for a tenant.
- `GET /api/caretaker/maintenance-requests` — caretaker queue with filtering by property, status, and urgency.
- `PATCH /api/caretaker/maintenance-requests/{id}` — update status, assign service providers, add notes.
- `POST /api/move-out/notices` — tenant move-out notifications with timestamp verification.
- `POST /api/move-out/confirmations` — landlord/caretaker confirmations for vacancy verification.
- `GET /api/move-out/inspections` — inspection schedules, checklists, and evidence uploads.

## Digital Document Management (Requirements §4)

Endpoints required to manage leases, receipts, inspections, and other artefacts for all roles.

- `GET /api/documents` — list documents accessible to the current user with filtering and pagination.
- `POST /api/documents` — upload a new document (metadata + binary file) with category/type tagging.
- `GET /api/documents/{id}` — retrieve document metadata, access logs, and download URL.
- `PATCH /api/documents/{id}` — update document metadata (description, tags, visibility) or trigger archiving.
- `DELETE /api/documents/{id}` — delete or revoke access to a document.
- `GET /api/documents/audit-log` — access/version log for compliance tracking.

## Integrated Community Marketplace (Requirements §5)

Endpoints expected to power community listings, services, and housing inventory.

- `GET /api/marketplace/listings` — fetch marketplace listings with category filters and pagination.
- `POST /api/marketplace/listings` — allow tenants or verified businesses to post new listings.
- `GET /api/marketplace/listings/{id}` — retrieve full listing details including seller contact and audit history.
- `POST /api/marketplace/listings/{id}/inquiries` — contact seller/caretaker directly through the platform.
- `GET /api/marketplace/categories` — discover available listing categories and metadata.

## Communication & Notifications (Requirements §7)

Endpoints needed for direct messaging, announcements, and notification badges.

- `GET /api/communications/conversations` — list the user’s conversations with unread counts.
- `POST /api/communications/conversations/{id}/messages` — send a new message to a landlord, caretaker, or tenant.
- `GET /api/communications/conversations/{id}` — fetch conversation history with pagination.
- `GET /api/communications/notifications` — retrieve notifications with type filters (payment, maintenance, system).
- `PATCH /api/communications/notifications/{id}` — mark notification as read/dismissed.

## Rating & Review System (Requirements §8)

- `GET /api/reviews` — retrieve paginated reviews for the current tenant with filtering by subject type.
- `POST /api/reviews` — submit a new tenant review with rating and comment.
- `PATCH /api/reviews/{id}` — allow updates or moderation responses.
- `GET /api/reviews/summary` — aggregate ratings for dashboards and transparency reports.

## Admin Analytics & Approvals (Requirements §§9–10)

- `GET /api/admin/dashboard/stats` — consolidated platform KPIs for admin overview.
- `GET /api/admin/analytics` — time-series platform analytics for reports.
- `GET /api/admin/businesses/pending` — list pending business approvals.
- `POST /api/admin/businesses/{id}/approve` — approve business applications (with audit trail).
- `POST /api/admin/businesses/{id}/reject` — reject business applications with reason code.
- `GET /api/admin/advertisements/pending` — moderation queue for advertisement approvals.
- `POST /api/admin/advertisements/{id}/approve` — approve advertisements.
- `POST /api/admin/advertisements/{id}/reject` — reject advertisements with feedback.

Until these endpoints are available, the frontend should rely on dummy providers/services that return mock data. Replace the mocks with real HTTP calls once the backend supplies the operations above.
