# pressure/

Product signals that are **not** current truth but affect future decisions:

- **user expectations** — what people expect, request, assume, depend on
- **pains** — where the system creates friction, surprise, or recurring cost
- **improvement opportunities** — changes suggested by evidence, gaps, regressions, unmet needs
- **unmet needs** — valuable expectations the current behavior does not satisfy

## Current state

**No external pressure captured yet.** This is a new project with no users, no integrators, no issues, no support tickets, no production usage.

When signals arrive (first issue, integrator request, support thread, design partner feedback), classify them via `/evidence-arrived` and add a file here. Never mix pressure with `behavior/`.

## Convention (for when signals arrive)

One file per signal, frontmatter shape:

```yaml
---
id: pressure-<short-slug>
type: pressure
status: open | accepted | rejected | satisfied
category: expectation | pain | opportunity | unmet-need
who: "<who expressed it: integrator name, role, or issue link>"
touches:
  - <id of domain concept or capability>
related_contracts:
  - <id of behavior contract>
satisfied_by_current_behavior: true | false | partial
evidence:
  - source: "<issue / PR / thread / email>"
---
```

Body: short description, what is requested, why it matters, what would satisfy it.
