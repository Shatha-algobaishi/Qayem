# Clean source release

This repository contains the maintained React/TypeScript and Java/Spring Boot
source only. It starts with a new Git history. Uploaded CVs, original Git history,
legacy .NET deployment material and unused legacy artwork are excluded.

## Changes

- Hardened current-account and role authorization, private candidate/CV access,
  token validation, refresh rotation, login limiting and evaluation score validation.
- Added a separate H2 demo and loopback-only practice mode with fictional records and all four roles.
- Redesigned bilingual sign-in, role selection and responsive navigation.
- Improved error/empty states, output escaping, report pagination and exports.
- Updated dependencies, added Java integration and security tests and prepared CI.

## Skills used

- Anthropic frontend-design, commit 2c5958ecac7cee2b583967a2c4981d0f4a75c579.
- OpenAI playwright and security-best-practices, commit
  49f948faa9258a0c61caceaf225e179651397431.
- All three skills carry Apache-2.0 licenses. This does not grant a project license.

See SYSTEM-MAP.md, DESIGN-SYSTEM.md, SECURITY.md and VERIFICATION.md for the
architecture, tested scope and remaining work. No production readiness or full
accessibility certification is claimed.
