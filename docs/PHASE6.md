Phase 6 - Orchestration & Robust Deployments

Goals
- Improve deployment robustness and scalability.
- Standardize orchestration, health checks, and monitoring.
- Enable repeatable rollouts and rollbacks.

Planned Outcomes
- Containerized services (app, LiveKit, DB) with environment configs.
- Orchestration plan (Docker Compose or Kubernetes) with service discovery.
- Health checks for API, LiveKit, and DB.
- Centralized logging and metrics dashboards.
- Backup and restore procedures for DB and recordings.
- Automated deployment pipeline with staging and production.

Scope Notes
- Choose orchestrator during Phase 6 kickoff.
- Keep security controls aligned with Phase 2A.
- Define SLOs and alerting thresholds.

Acceptance Criteria
- Services can be deployed/redeployed from clean state in <30 minutes.
- Health checks and alerts detect service failures.
- Rollback procedure restores last known good version.
