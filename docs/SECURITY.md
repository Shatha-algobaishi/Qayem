# Security review and publication gate

## Clean release boundary

This repository has a new history and excludes uploaded CVs, the original Git
history, legacy deployment archives and local environment values. Credentials
previously exposed in an older distribution must still be rotated by their owner;
removing them from this release does not revoke them.

No project license was invented. Confirm project and asset rights before
granting a reuse license. This is not an official government service.

## Implemented controls

- Java production configuration requires external database and JWT secrets.
  A short JWT key is rejected rather than padded. Issuer, audience, signature
  and expiry are verified.
- Current user state and roles are loaded on each request. Disabled/deleted users
  and removed roles cannot continue using stale token claims.
- BCrypt hashing is retained. First administrator provisioning uses an explicit
  environment password and grants Admin only. No self-registration exists.
- Refresh rotation uses a transaction and pessimistic lock. Revocation checks
  ownership. Password changes invalidate refresh tokens. Password and token
  request records redact their diagnostic string representation.
- Login attempts are limited per remote address and application instance.
  Multi-instance production deployments need a corresponding edge limit.
- Candidate detail, evaluator list and CV access use assignment checks for
  evaluators. Candidate list queries restrict records by direct/session assignment.
- Evaluation answers reject unknown/inactive/duplicate questions, oversized notes,
  and scores outside configured bounds. Save and submission are transactional;
  active questions must all be answered. AI work is scheduled after commit.
- Demo passwords are supplied through local environment configuration; test
  passwords and signing keys are generated at runtime. No reusable passwords are
  included in source or documentation.
- A separate H2 demo database contains only fictional data; data-changing requests are blocked server-side in read-only demo mode, except authentication lifecycle. An explicit demo-local profile permits workflow writes on loopback only; account administration remains blocked.
- Printable user text is HTML-escaped and signatures accept PNG data only.
  CSV fields are quoted and spreadsheet formula prefixes neutralized.
- Security headers are present in nginx; Java container runs as a non-root user.

## Dependency audit

Frontend audit is clean after updates, including Vite 8, React Router 7 and
the official SheetJS 0.20.3 tarball. TypeScript, lint and production build must
continue to pass after dependency updates.

OSV was queried against 125 resolved Maven packages. Patched Tomcat, Jackson,
PostgreSQL, Log4j API, Commons Lang, PDFBox, POI and Spring Boot dependencies
replaced the old versions. Two advisories remain for Spring MVC 6.2.19:

| Advisory | Feature | Current assessment |
| --- | --- | --- |
| GHSA-j9f9-w8pj-32f8 | Server-sent event fragment rendering | No server-side fragment rendering or SSE endpoint found |
| GHSA-pc63-qcmh-9cmg | XsltView path limitation | No XSLT view configuration or view templates found |

These are dependency findings, not a claim of application exploitability or a
clean audit. Public fixes listed by OSV require Spring Framework 7, which is a
larger migration than a patch within the existing Boot 3 architecture. Reassess
when enabling those features or planning a Boot 4 migration. The raw audit script
intentionally reports them rather than suppressing them.

## Remaining limitations

- Bearer tokens remain in localStorage under the existing frontend contract.
  A future HttpOnly cookie/BFF migration needs CSRF and session redesign.
- Logout revokes the refresh token and clears browser credentials; an already
  copied access token remains valid until expiry unless the account is disabled.
- No distributed login throttling, production PostgreSQL integration test,
  penetration test, complete screen-reader audit or full WCAG certification was
  performed. AI output quality and file-malware scanning are not verified.
- Legacy .NET source and old deployment scripts are excluded from this release.
- Hibernate `ddl-auto=update` remains; establish versioned migrations before
  production database upgrades.
