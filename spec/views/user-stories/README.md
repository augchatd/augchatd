# user-stories/

Narrative derivations of [behavior contracts](../../src/behavior/contracts/), versioned because they carry phrasing that is not in the contract itself.

## Purpose

- Validate contracts with non-technical stakeholders (or, for augchatd, the integrator's product owner / engineering lead).
- Expose gaps — if a generated story sounds odd, the contract is poorly formulated or covers something nobody asked for.
- Preserve phrasing validated in real conversations.

## Convention

One file per story. Frontmatter:

```yaml
---
id: story-<NNNN>-<short-slug>
type: user-story
status: proposed | current | deprecated
derived_from:
  - <id of contract this story narrates>
audience: "<who tells this story>"
---
```

Body:

```
As <role>
I want <observable outcome>
So that <reason>

Scenario:
  Given ...
  When ...
  Then ...
```

## When a story is edited

If editing the story reveals a real difference from the contract, run `/view-changed` — reconciliation updates the contract (the canonical source). Stories are not canonical, but editing them is an input for change.
