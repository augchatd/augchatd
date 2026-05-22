# evidence/test-pointers/

No tests exist yet. This folder will hold `test-file:test-name@commit` references once tests begin to land.

## Convention (for when tests land)

One file per pointer, frontmatter shape:

```yaml
---
id: test-ptr-<short-slug>
type: evidence
status: current
source_kind: test
ref: "tests/sessions.test.ts::creates session when S3 writable@<commit-sha>"
protects: contract-session-create   # id of the spec file this test guards
---
```

Body: one line on what the test asserts, plus a link back to the relevant `spec/src/behavior/contracts/*.md` file.
