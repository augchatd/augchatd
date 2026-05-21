# history/

Past events that **still** explain a current constraint, a live decision, or a real risk.

The rule: history only enters the spec when its **absence** would make a current part of the system inexplicable.

## Current state

**No relevant history yet.** This is a new project — there is no past behavior to constrain the present.

The repo currently has two commits (`c515abf` initial, `e562b2b` initial readme); both are visible via `git log`. They do not need a `history/` file unless a future decision becomes inexplicable without them.

## Convention (for when history matters)

One file per topic, frontmatter shape:

```yaml
---
id: history-<short-slug>
type: history
status: current
why_still_relevant: "<one sentence: which constraint/decision/risk this explains>"
related:
  - <id of spec file this history backs>
---
```

Body: short narrative of what happened, plus the explicit link to the present-day artifact that needs it.

If the justification (`why_still_relevant`) ever disappears, **delete the file**. History without a current load-bearing reason belongs in `git log` and the issue tracker, not in the spec.
