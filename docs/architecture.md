# Architecture

ClawSweeper Operant Lab is a governed autonomous engineering runtime.

It is not an agent that acts first. It prepares, constrains, simulates, validates, and explains action before humans authorize remote consequences.

## Four-Layer Model

```text
Cognitive Layer
-> Governance Layer
-> Execution Layer
-> Human Interface Layer
```

```mermaid
flowchart TB
  subgraph Cognitive["Cognitive Layer"]
    Records["Durable records"]
    Memory["Review Memory"]
    Priority["Priority Engine"]
    Routing["Model Routing"]
    Confidence["Confidence Engine"]
    Adaptive["Adaptive Scheduler Recommendations"]
    RFC["Policy RFC Engine"]
  end

  subgraph Governance["Governance Layer"]
    Promotion["Policy Promotion"]
    DSL["Policy DSL"]
    Shadow["Shadow Runtime"]
    Metrics["Shadow Metrics"]
    Approval["Approval Gate"]
    Improve["Improvement Loop"]
    Dashboard["Governance Dashboard"]
    Intent["Intent Artifacts"]
  end

  subgraph Execution["Execution Layer"]
    BranchIntent["Branch Creation Intent"]
    BranchPreview["Branch Dry-run Executor"]
    BranchExec["Guarded Local Branch"]
    PatchApply["Isolated Patch Application"]
    Validation["Local Validation"]
    CommitIntent["Commit Intent"]
    CommitPreview["Commit Dry-run Executor"]
    CommitExec["Guarded Local Commit"]
  end

  subgraph Human["Human Interface Layer"]
    PRPackage["PR Package"]
    ManualGuide["Manual PR Guide"]
    Demo["Demo Report"]
    Walkthrough["Operational Walkthrough"]
  end

  Records --> Memory
  Memory --> RFC
  Memory --> Priority
  Memory --> Routing
  Memory --> Confidence
  RFC --> Promotion
  Promotion --> DSL
  DSL --> Shadow
  Confidence --> Shadow
  Shadow --> Metrics
  Metrics --> Approval
  Adaptive --> Dashboard
  Improve --> Approval
  Approval --> Intent
  Dashboard --> Intent
  Intent --> BranchIntent
  BranchIntent --> BranchPreview
  BranchPreview --> BranchExec
  BranchExec --> PatchApply
  PatchApply --> Validation
  Validation --> CommitIntent
  CommitIntent --> CommitPreview
  CommitPreview --> CommitExec
  CommitExec --> PRPackage
  PRPackage --> ManualGuide
  PRPackage --> Demo
  ManualGuide --> Walkthrough

  ManualGuide -. "operator-owned remote action" .-> HumanDecision["Human decision"]
  HumanDecision -. "outside current MVP" .-> Remote["Remote GitHub action"]

  classDef cognitive fill:#eef7ff,stroke:#2563eb,color:#111;
  classDef governance fill:#f5f3ff,stroke:#7c3aed,color:#111;
  classDef execution fill:#ecfdf5,stroke:#059669,color:#111;
  classDef human fill:#fff7ed,stroke:#d97706,color:#111;
  classDef boundary fill:#f8fafc,stroke:#64748b,color:#111;

  class Records,Memory,Priority,Routing,Confidence,Adaptive,RFC cognitive;
  class Promotion,DSL,Shadow,Metrics,Approval,Improve,Dashboard,Intent governance;
  class BranchIntent,BranchPreview,BranchExec,PatchApply,Validation,CommitIntent,CommitPreview,CommitExec execution;
  class PRPackage,ManualGuide,Demo,Walkthrough human;
  class HumanDecision,Remote boundary;
```

## Operating Doctrine

```text
The system prepares;
the operator decides.
```

The lab is designed to make AI-prepared software changes observable, reviewable, reversible, and bounded.

## Artifact Flow

```text
Evidence
-> Proposal
-> Approval
-> Simulation
-> Intent
-> Governance
-> Guarded Branch
-> Isolated Apply
-> Local Validation
-> Commit Intent
-> Commit Preview
-> Guarded Commit
-> PR Package
-> Manual PR Guide
```

## Boundary

The architecture deliberately stops before unattended remote action.

Current MVP:

- local governed execution
- human-ready remote guidance
- no GitHub mutation
- no push
- no PR creation
- no merge

Future remote governance must preserve the same staged contract:

```text
Manual PR Guide
-> Remote Action Intent
-> Remote Action Dry-run
-> Operator Approval
-> Guarded Remote Action
```
