// Pilot candidates test — pilot list is non-empty, each pilot's components
// are all on both platforms, each pilot lists >=1 remaining blocker (no false
// Ready claim), and conditional candidates carry a verificationNeeded item.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  CONDITIONAL_CANDIDATES,
  PILOT_CANDIDATES,
  PILOT_SUMMARY,
  READY_CATALOG_ENTRIES,
  validatePilotConsistency,
} from '../../src/block-catalog/index.ts';
import { getCandidateById } from '../../src/block-catalog/categories/index.ts';

test('pilot-candidates: pilot list is non-empty', () => {
  assert.ok(PILOT_CANDIDATES.length > 0, 'expected at least one pilot');
});

test('pilot-candidates: readyCount matches READY_CATALOG_ENTRIES length', () => {
  assert.equal(PILOT_SUMMARY.readyCount, READY_CATALOG_ENTRIES.length);
  assert.ok(PILOT_SUMMARY.readyCount > 0, 'at least one entry is now Ready');
});

test('pilot-candidates: internal consistency check passes', () => {
  const result = validatePilotConsistency();
  assert.equal(result.ok, true, result.problems.join('; '));
});

test('pilot-candidates: every pilot resolves to a candidate entry', () => {
  for (const p of PILOT_CANDIDATES) {
    const entry = getCandidateById(p.id);
    assert.ok(entry, `pilot ${p.id} not found in candidate entries`);
  }
});

test('pilot-candidates: every pilot has >=1 remaining blocker', () => {
  for (const p of PILOT_CANDIDATES) {
    assert.ok(
      p.remainingBlockers.length > 0,
      `pilot ${p.id} has no remaining blockers (false Ready claim)`,
    );
  }
});

test('pilot-candidates: every conditional has a verificationNeeded', () => {
  for (const c of CONDITIONAL_CANDIDATES) {
    assert.ok(
      c.verificationNeeded.length > 0,
      `conditional ${c.id} has no verificationNeeded`,
    );
  }
});

test('pilot-candidates: expected clean pilots are present', () => {
  const ids = PILOT_CANDIDATES.map((p) => p.id);
  assert.ok(ids.includes('content.plain-text'), 'content.plain-text should be pilot');
  assert.ok(ids.includes('content.faq'), 'content.faq should be pilot');
});

test('pilot-candidates: action-dependent entries are NOT pilots', () => {
  const ids = PILOT_CANDIDATES.map((p) => p.id);
  // form needs P3 actions; must not be a clean pilot
  assert.ok(!ids.includes('interaction.form'));
  // record-list needs performance budget + datasource conventions
  assert.ok(!ids.includes('data.record-list'));
  // cart-checkout is component-gap
  assert.ok(!ids.includes('commerce.cart-checkout'));
});

test('pilot-candidates: chart/diagram-viewer/hero are conditional not pilot', () => {
  const pilotIds = PILOT_CANDIDATES.map((p) => p.id);
  const condIds = CONDITIONAL_CANDIDATES.map((c) => c.id);
  assert.ok(!pilotIds.includes('analytics.chart'));
  assert.ok(condIds.includes('analytics.chart'));
  assert.ok(!pilotIds.includes('workflow.diagram-viewer'));
  assert.ok(condIds.includes('workflow.diagram-viewer'));
  assert.ok(!pilotIds.includes('content.hero'));
  assert.ok(condIds.includes('content.hero'));
});
