# System map

The browser calls `/api/v1`; nginx or Vite proxies to the Java API on port 5020.
Spring Security verifies JWT signatures, issuer, audience and current database
roles. JPA repositories persist to PostgreSQL; the demo substitutes disposable H2.
Uploaded CVs are private filesystem resources. Optional Ollama calls run locally.

| Module / routes | Users | Data and relationships | Authorization / workflow |
| --- | --- | --- | --- |
| `/login`, `/select-role`; `/auth/*` | All account holders | Users, primary role, additional UserRole assignments, refresh tokens | Administrator-managed accounts; BCrypt; rotating refresh; choose an assigned workspace |
| `/sessions`, `/sessions/new`, `/sessions/:id` | Admin, DataEntry, Evaluator | InterviewSession has candidates and SessionEvaluator assignments | Admin/DataEntry create and update; evaluators review interview context |
| `/candidates`, `/candidates/new`, `/candidates/:id` | Admin, DataEntry, Manager; assigned Evaluator | Candidate links optional session, direct evaluators, evaluations and CV | Admin/DataEntry manage; managers review; evaluators restricted by direct or active session assignment |
| `/evaluations/my`, `/evaluations/start`, `/evaluations/:id` | Evaluator | Evaluation belongs to a candidate, evaluator and optional session; contains Question answers | Owner saves draft and submits once; active questions must be answered; scores validated against question maximum |
| `/manager/dashboard`, `/manager/pending` | Manager, Admin | Candidate aggregates, final decisions and discrepancy flags | Review and override hiring decisions with audit records |
| `/manager/sessions/:id/compare`, `/manager/evaluator-analytics` | Manager, Admin | Submitted evaluations, score differences and comparative rankings | Review-only analytical views, no fabricated scores |
| `/reports` | Manager, Admin | Candidate, session, evaluator and final result datasets | Filter and export CSV/Excel |
| `/admin/users` | Admin | User status, primary/additional roles | Only administrators create accounts or assign roles |
| `/admin/questions`, `/admin/reference-lists`, `/admin/settings` | Admin | Question maxima/order, reference values, score thresholds | Controlled configuration; authenticated users can read a named reference list needed by forms |
| `/manager/audit`, notifications | Admin/Manager; individual recipient | AuditLog and Notification | Administrative review; per-user notification access |

## Key lifecycle

Register candidate → assign to session/evaluator → evaluator saves answers →
submit once → aggregate scores and discrepancy → manager final decision → report.
Optional AI summaries are scheduled after transaction commit. Demo data is
read-only and never shares the production datasource.

## Engineering boundaries

- React feature slices and pages reuse the shared shell, tokens and API client.
- Backend controller/repository architecture is retained. `CandidateAccess`
  centralizes per-candidate read authorization.
- Selected workspace is a UI preference, not a security authority. The server
  uses the full set of currently assigned roles.
- Legacy .NET code and SQL scripts are not included in this release.
