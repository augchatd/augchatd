# evidence/traces/

No traces yet (no production system). This folder will hold anonymized captures (request/response, log slices, screenshots) that demonstrate a contract under real load.

## Convention (for when traces land)

One file per trace, frontmatter shape:

```yaml
---
id: trace-<short-slug>
type: evidence
status: current
source_kind: trace
captured: 2026-MM-DD
demonstrates: contract-session-chat   # id of the spec file this trace illustrates
---
```

Body: pasted (anonymized) trace excerpts, plus a one-line summary of what they prove.
