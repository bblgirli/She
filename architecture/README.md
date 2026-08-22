# She architecture

This directory documents the staged architecture migration inspired by the stable Smart-Bank project structure.

Principles:
- preserve the existing UI and Firebase data model
- initialize Firebase once per page lifecycle
- isolate auth/session, data, presence, and feature boundaries
- make account switching explicit and race-safe
- migrate incrementally; never replace working features wholesale

Migration order:
1. shared bootstrap/session boundary
2. data access boundary
3. presence boundary
4. feature pages
5. optional server-side services where they provide a real reliability/security benefit

No existing production behavior is removed by this marker commit.