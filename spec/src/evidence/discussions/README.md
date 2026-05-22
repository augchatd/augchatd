# evidence/discussions/

Pointers to PRs, issues, ADR-source threads, design discussions.

## Current contents

- [readme-initial.md](readme-initial.md) — the project's initial `README.md` at commit `e562b2b`. The only primary source so far.

## Convention

One file per discussion, frontmatter shape:

```yaml
---
id: disc-<short-slug>
type: evidence
status: current
source_kind: discussion
ref: "https://github.com/<org>/<repo>/pull/<n>"   # or issue, or commit
captured: 2026-MM-DD
informs: <id of spec file this discussion informs>
---
```

If the link could evaporate (closed issue, deleted comment, archived thread), snapshot the content into the file body.
