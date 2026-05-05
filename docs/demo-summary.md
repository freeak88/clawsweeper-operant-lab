# Demo Summary: ClawSweeper Operant Lab

## Problem

Maintenance bots see the same patterns again and again, but repeated experience is usually trapped inside logs, comments, and review records. The question is: can the system learn from that history without becoming risky?

Operant Lab shows a conservative answer: turn repeated patterns into proposals, simulate them, measure them, and only then consider guarded action.

## Input

The demo used five sample ClawSweeper-style review records. Each record described a low-risk maintenance/docs item with the same repeated signal:

- maintenance label
- annotation-only verdict
- successful repair marker
- documentation conflict type

## What The System Did

| Step              | Result                                                |
| ----------------- | ----------------------------------------------------- |
| Build memory      | Indexed the five records into a local memory file     |
| Generate RFCs     | Found repeated patterns and produced policy proposals |
| Promote RFC       | Moved one proposal to candidate status                |
| Run DSL           | Tested a deterministic annotation-only rule           |
| Shadow runtime    | Simulated what the policy would have proposed         |
| Shadow metrics    | Measured confidence, risk, and safety gates           |
| Guarded execution | Ran in dry-run mode and logged the final decision     |

## Key Numbers

- Records analyzed: `5`
- Repeated patterns detected: `5+`
- Policy matches in simulation: `5`
- Live executions: `0`
- GitHub mutations: `0`
- Issues closed: `0`
- PRs merged: `0`
- Repairs dispatched: `0`

## Decision: Do Nothing

The most important result is that the system did not act.

Even though the policy matched all five records, the metrics layer did not mark it safe enough for guarded execution. The average confidence stayed below the conservative threshold, so Guarded Execution logged a dry-run decision instead of taking action.

That is the point of the lab: automation should prove itself in simulation before it earns permission to do anything live.

## Why No Execution Happened

Execution was blocked because the policy had not cleared the confidence threshold. The system treated repeated matches as useful evidence, but not as permission.

The final guarded decision was:

```text
executed=false
action=none
reason=dry_run=true prevents execution
```

## Safe Next Step

The safe next step is more shadow testing:

- run the policy against a larger historical dataset
- compare simulated suggestions with maintainer judgment
- tune confidence and risk scoring only after review
- keep execution disabled until evidence is stronger

## Conclusion

Safe automation requires simulation first.

Operant Lab demonstrates a path from historical records to policy candidates without jumping straight to action. The system can learn, propose, test, and explain itself while still preserving the safest possible outcome: when confidence is not high enough, it does nothing.
