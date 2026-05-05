# Model Routing Metadata

Model Routing classifies planned review items into proposal-only routing tiers and emits recommended model and reasoning metadata. It is advisory metadata for future execution routing; it does not change the Codex invocation used by review shards in this PR.

## Purpose

ClawSweeper reviews a mix of small issues, routine pull requests, broad repairs, and high-risk workflow or security changes. The Model Routing classifier gives planning/status output a deterministic way to explain which tier an item appears to belong to before any future routing behavior is implemented.

## Tiers

- `trivial`: low-risk simple issue or low-priority item
- `standard`: normal review surface
- `complex`: broad pull requests, config changes, prior repair/conflict signals, or repeated memory patterns
- `high-risk`: workflow, security, apply, automerge, release, or other sensitive paths and labels

## Signals

The classifier can use:

- `priority_score` and `priority_band`
- labels
- item type, issue or pull request
- touched file paths
- review memory patterns
- prior repair markers
- conflict types
- CI/check failure markers
- workflow, config, security, apply, automerge, and release-sensitive paths

Missing fields are allowed and produce stable low-impact reasons rather than throwing.

## Output

```json
{
  "routing_tier": "complex",
  "recommended_model": "gpt-5.5",
  "recommended_reasoning_effort": "high",
  "routing_reasons": ["broad change touches 8 files"]
}
```

## Planning Metadata

Planning/status metadata can be exposed with:

```sh
CLAWSWEEPER_ENABLE_MODEL_ROUTING_METADATA=1 pnpm run plan
```

When enabled, selected candidate JSON may include `routing_tier`, `recommended_model`, `recommended_reasoning_effort`, and `routing_reasons`. Sweep status JSON records `model_routing_metadata_enabled: true`.

This flag only changes emitted metadata. It does not change item selection, bucket order, shard count, batch size, capacity, continuation behavior, apply, automerge, GitHub mutation behavior, or the actual Codex model/reasoning used by review shards.

## Future Execution Routing

A future PR may choose to consume this metadata to route review shards to different model profiles. That should be implemented behind a separate explicit execution flag, with scheduler and review-shard tests proving that selection, capacity, and mutation boundaries remain conservative.
