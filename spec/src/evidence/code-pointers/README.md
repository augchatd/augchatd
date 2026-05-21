# evidence/code-pointers/

No code exists yet. This folder will hold `file:line@commit` references once implementation begins.

## Convention (for when code lands)

One file per pointer, frontmatter shape:

```yaml
---
id: code-ptr-<short-slug>
type: evidence
status: current
source_kind: code
ref: "src/sessions/create.ts:42@<commit-sha>"
proves: contract-session-create   # id of the spec file this evidence backs
---
```

Body: a short quote of the relevant lines or a one-line description of what they prove.
