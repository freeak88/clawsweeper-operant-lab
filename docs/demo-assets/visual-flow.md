# Visual Flow Asset

This file contains Markdown-ready visual blocks for demos, slides, and landing pages.

## Bad Default AI Agent Loop

```mermaid
flowchart LR
  Agent["AI agent"] --> Action["Action"]
  Action --> Hope["Hope"]
  Hope --> Risk["Operational risk"]

  classDef danger fill:#fef2f2,stroke:#dc2626,color:#111;
  class Agent,Action,Hope,Risk danger;
```

Caption:

```text
agent -> action -> hope
```

## Governed Operant Loop

```mermaid
flowchart LR
  Evidence["Evidence"] --> Proposal["Proposal"]
  Proposal --> Approval["Approval"]
  Approval --> Simulation["Simulation"]
  Simulation --> Intent["Intent"]
  Intent --> Constrained["Constrained local action"]
  Constrained --> Explain["Explain"]
  Explain --> Human["Human authorization"]

  classDef safe fill:#ecfdf5,stroke:#059669,color:#111;
  classDef govern fill:#f5f3ff,stroke:#7c3aed,color:#111;
  classDef human fill:#fff7ed,stroke:#d97706,color:#111;

  class Evidence,Proposal govern;
  class Approval,Simulation,Intent govern;
  class Constrained,Explain safe;
  class Human human;
```

Caption:

```text
evidence -> approval -> simulation -> constrained action
```

## Four Layers

```mermaid
flowchart TB
  Cognitive["Cognitive Layer\nReview Memory, Priority, Routing, Confidence"]
  Governance["Governance Layer\nApproval, Shadow Runtime, Metrics, Cockpit"]
  Execution["Execution Layer\nIsolated Apply, Validation, Guarded Commit"]
  Interface["Human Interface Layer\nPR Package, Manual Guide, Demo"]

  Cognitive --> Governance --> Execution --> Interface
```

## Local Governed Execution MVP

```mermaid
flowchart LR
  E["Evidence"] --> P["Proposal"]
  P --> A["Approval"]
  A --> S["Simulation"]
  S --> I["Intent"]
  I --> G["Guarded Branch"]
  G --> X["Isolated Apply"]
  X --> V["Validation"]
  V --> C["Guarded Commit"]
  C --> R["PR Package"]
  R --> M["Manual Guide"]
```

## Safety Panel

```text
Safety guarantees

- default dry-run
- explicit execute gates
- isolated execution
- deterministic artifacts
- rollback generation
- operator-owned remote action
- no hidden mutation
```

## Intentionally Not Automated Panel

```text
Intentionally not automated

- autonomous merge
- unattended remote mutation
- hidden GitHub actions
- self-modifying execution policy
- remote PR creation in the current MVP
```
