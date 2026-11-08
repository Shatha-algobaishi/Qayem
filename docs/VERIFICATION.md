# Qayem verification ? 2026-11-08

Executed in the independent Qayem folder on Windows, Java 21 and Node 24.

## Passed locally

- Maven verify: 35 tests, zero failures/errors/skips. Includes authorization, JWT/refresh protections, score validation and full evaluation save/submit lifecycle.
- Six fixture regression tests check 4 sessions, 12 candidates, 3 evaluators, 36 assignments, 25 submitted/reviewed evaluations, 2 drafts, 7 final decisions, reports, filters and CSV.
- Missing evaluator comparison returns HTTP 200 and JSON null scores. A draft and a wholly missing evaluation remain unscored; assignment denominator is 3. Partial candidate C008 averages only the single submitted score (18), excluding its draft and pending evaluator.
- Local practice guard rejects non-loopback configuration. Workflow start is permitted; account/password administration remains forbidden.
- Frontend npm ci, TypeScript, ESLint and Vite production build pass. npm audit reports zero vulnerabilities.
- Running packaged backend on 5020 and frontend on 5200: actual demo login and all four role selections reach their expected pages without JavaScript errors.
- Chromium comparison shows C005/C006 as em dash and 0/3, C008 as 18.00 and 1/3. Dashboard, pending decisions, evaluator analytics, candidates, reports and demo guide mounted with no failed API responses in this run.
- Actual browser CSV and XLSX downloads parsed: header plus 12 fictional candidates, 7 columns; spreadsheet ZIP integrity and worksheet row count pass.
- Mobile report viewport 390 x 844 has no document horizontal overflow. Newly captured login, workspace, comparison and mobile screenshots contain fictional data only.
- Separate running demo-local instance on 5021: login, start C006, save six scores and submit pass; resulting status Submitted, total 24. This modifies only its disposable H2 instance.

- Read-only smoke script: all 30 selected API endpoints passed.
- Full staged-source privacy/identity scan and Gitleaks 8.30.1: no secrets detected; no uploads, environment files, dependency/build directories or authenticated artifacts staged. Third-party author attribution in the dependency lockfile is retained.

## Limits

Production PostgreSQL, Docker runtime, AI quality, full workflow permutations, penetration testing and complete manual accessibility certification were not executed. AI is disabled in demo. Existing Spring MVC advisories remain documented in SECURITY.md; no new Maven vulnerability audit is claimed for this continuation.

Authenticated browser scripts, runtime passwords, raw logs, comparison evidence and original fingerprint manifests are ignored under output/private-verification. Only reviewed screenshots and clean source are published. GitHub publication integrity is checked by comparing the full remote Git tree with the local staged tree; CI results are reported separately after upload.
