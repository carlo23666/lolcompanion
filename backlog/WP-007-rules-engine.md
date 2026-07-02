# WP-007 — Rules engine v1

## Objective
First deterministic recommendation layer: contextual adjustments with mandatory explanations.

## Scope
- `src/main/engine/rules/`: rule interface `(GameState, StaticData) → RuleOutput[]` where RuleOutput = { itemId | category, action: 'prioritize'|'add'|'delay', score 0-100, reasons: string[] (Spanish, concrete, with numbers) }.
- Rules v1 (each in its own file, each fully tested):
  1. `antiheal`: enemy healing index over threshold → Executioner's/Chempunk/Morello per role, with gold-aware timing.
  2. `armor-vs-mr`: enemy damage split → defensive stat priority + concrete item options for self champion class.
  3. `anti-tank`: enemy tankiness index → % pen / Botrk / Liandry per own damage type.
  4. `anti-burst`: fed assassin/burst threat targeting self (enemy score + items) → Zhonya/GA/Mercurial class suggestions.
  5. `spike-now`: own gold vs cost of next component/completion → "buy now vs wait N gold" on current recall.
- Combiner: merge RuleOutputs into ranked Recommendation[] (dedupe, sum scores, keep all reasons).
- Threshold constants in one tunable file with comments explaining each number.

## Acceptance criteria
- [ ] Each rule has table-driven tests over fixture GameStates including negative cases (rule stays silent when it should).
- [ ] Combined output on the recorded real game produces sensible top-3 at min 10/20/30 — owner sanity-check documented in worklog.
- [ ] Zero I/O in engine (enforced by test importing engine in isolation).

## Out of scope
Baseline builds (WP-009). Win-probability, ML. ANY cooldown-based logic (policy).

## Review checklist
Reasons are specific ("62% del daño enemigo es físico, su ADC lleva 2 items") not generic ("compra armadura"); thresholds documented; negative tests present.
