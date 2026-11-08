# Qayem verification — expanded demo, 2026-11-08

Executed inside the independent Qayem folder on Windows, Java 21 and Node 24. The original projects were read only for SHA-256 verification.

## Automated checks passed

- Maven clean verify and subsequent final verify: **41 tests, zero failures/errors/skips** on the final backend. Coverage includes authentication/authorization, refresh/JWT, score boundaries, submitted-answer consistency, fictional fixture diversity, idempotent seeding, six department filters, profile relationships and report/export counts.
- Direct visitor login requires no password, returns no server password and is read-only. Operational mode and local practice reject visitor login. The demo isolation guard refuses a persistent datasource; practice requires loopback.
- Missing and draft comparison entries stay null. C005/C006 show no average, 0/3; C008 has one submitted score of 18 and displays 18.00, 1/3, excluding its draft and pending evaluator.
- Dashboard categories and candidate filters match: Recommended 9, Conditional 8, Not Qualified 5, Employed 1, Unscored 7, total 30. Final decisions take precedence over provisional recommendations. A dedicated regression test verifies these partitions.
- Frontend TypeScript, ESLint and Vite production build pass on the final code. npm audit: zero vulnerabilities. Java dependency caveats remain in SECURITY.md; no new Maven advisory audit is claimed here.

## Running application and Chromium checks passed

- Started the packaged backend on 5020 and Vite on 5200. Actual passwordless demo entry, visible loading state, simulated HTTP 503 explanation and successful retry were exercised.
- All four role selections reached their expected routes. Thirteen selected role pages mounted: accounts, questions, settings, references, sessions, session/candidate forms, assigned evaluations, evaluation entry, pending decisions, evaluator analytics, audit and reports. This verifies rendering and reads, not every form submission.
- Live API checks verified all 30 profiles, three evaluator assignments per candidate, 69 evaluation records and submitted-only aggregate averages. Arabic/English name search and all department/status filters passed.
- Browser department, conflicting session, status and clear-all filters passed. A real initial-request race was fixed using a latest-request guard, then the browser scenario passed. Candidate list export now paginates within the API limit instead of requesting an unsupported page size.
- Browser search opened Noura's profile; the profile displays qualifications, department, job title, experience, fictional skills/notes, assigned evaluator names and evaluation details. Its interview-session link was followed successfully.
- Dashboard has two data-driven SVG charts. Clicking Recommended and View All produced the matching nine-candidate list, and clearing restored 30.
- Completed, wholly missing, draft-only and partially submitted comparisons rendered correctly. No JavaScript page errors or failed API responses occurred in the final browser filter/comparison/report run.
- Actual candidate-list CSV: 30 records, 11 columns. Report CSV: 30 records, 8 columns. Both include all six departments and fictional names. XLSX ZIP integrity and worksheet count (header + 30 rows) pass.
- All four report tabs show actual counts: candidates 30, sessions 6, evaluators 8, final results 13.
- Arabic and English desktop views were exercised. At 390 x 844, candidates, dashboard, comparison and reports have no document horizontal overflow; tables use their scroll regions. Mobile navigation opened and Escape dismissed it.
- New screenshots for the identity, login, workspaces, candidate list, profile, dashboard, comparison and mobile dashboard were captured and inspected. Wordmarks are production SVGs with shaped font outlines; imagegen was used for concept exploration only.

- Read-only smoke script: all 30 selected API endpoints passed using passwordless visitor access.
- Full staged-source privacy/identity review and Gitleaks 8.30.1 found no secrets or prohibited organizational references. Environment files, real uploads, raw traces and dependency/build folders are excluded.

## Remaining limits

Production PostgreSQL, Docker runtime, AI quality, full workflow permutations, penetration testing and a complete manual accessibility audit were not executed. AI is disabled in the demo; no generated assessment is fabricated. Candidates currently belong to one session; a multi-session candidate history is not implemented. No real CV files are bundled. Local practice workflow coverage relies on integration tests and the prior running save/submit check; this continuation's browser pass focuses on read-only visitor use.

Authenticated/raw artifacts remain ignored under output/private-verification. Only reviewed source, licensing notices, brand assets and screenshots are published. GitHub publication and CI results are verified after upload and reported separately.

SHA-256 comparison of **20,613 files** (10,512 + 10,101), including Git metadata, confirmed both protected original folders unchanged; commits and Git status also match their baseline.
