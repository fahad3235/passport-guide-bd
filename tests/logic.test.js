// Unit tests for Passport Guide BD logic. Run: node tests/logic.test.js
const assert = require('assert');
const L = require('../js/logic.js');
const I18n = require('../js/i18n.js');

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log('ok - ' + name); }

// 1. Fee table: all 12 combos exact (DIP schedule, updated 12 July 2026).
check('fee table has all 12 combos with exact DIP values', () => {
  const expected = {
    '48-5-regular': 4025, '48-5-express': 6325, '48-5-super': 8625,
    '48-10-regular': 5750, '48-10-express': 8050, '48-10-super': 10350,
    '64-5-regular': 6325, '64-5-express': 8625, '64-5-super': 12075,
    '64-10-regular': 8050, '64-10-express': 10350, '64-10-super': 13800
  };
  const rows = L.feeTableRows();
  assert.strictEqual(rows.length, 12);
  for (const r of rows) {
    assert.strictEqual(r.fee, expected[r.pages + '-' + r.years + '-' + r.speed],
      'fee mismatch ' + r.pages + '/' + r.years + '/' + r.speed);
  }
});
check('getFee returns null for invalid combos', () => {
  assert.strictEqual(L.getFee(32, 5, 'regular'), null);
  assert.strictEqual(L.getFee(48, 7, 'regular'), null);
  assert.strictEqual(L.getFee(48, 5, 'overnight'), null);
  assert.strictEqual(L.getFee('48', '10', 'express'), 8050); // string inputs coerce
});
check('delivery days match DIP schedule', () => {
  assert.deepStrictEqual(L.getDelivery('regular'), { min: 15, max: 21, label: '15-21 days' });
  assert.deepStrictEqual(L.getDelivery('express'), { min: 7, max: 10, label: '7-10 days' });
  assert.deepStrictEqual(L.getDelivery('super'), { min: 2, max: 2, label: '2 days' });
  assert.strictEqual(L.getDelivery('nope'), null);
});

// 2. Age / validity rule: 10-year only for 18-65.
check('validityAllowed enforces the 18-65 rule for 10-year', () => {
  assert.strictEqual(L.validityAllowed(17, 10), false);
  assert.strictEqual(L.validityAllowed(18, 10), true);
  assert.strictEqual(L.validityAllowed(65, 10), true);
  assert.strictEqual(L.validityAllowed(66, 10), false);
  assert.strictEqual(L.validityAllowed(10, 5), true);
  assert.strictEqual(L.validityAllowed(90, 5), true);
  assert.strictEqual(L.validityAllowed(null, 10), true);
  assert.strictEqual(L.validityAllowed('', 10), true);
  assert.strictEqual(L.validityAllowed(200, 10), false);
  assert.strictEqual(L.validityAllowed(-1, 5), false);
});

// 3. Date math.
check('daysUntil is exact incl. leap year and boundaries', () => {
  assert.strictEqual(L.daysUntil('2026-11-06', '2026-11-06'), 0);
  assert.strictEqual(L.daysUntil('2026-11-07', '2026-11-06'), 1);
  assert.strictEqual(L.daysUntil('2026-11-05', '2026-11-06'), -1);
  assert.strictEqual(L.daysUntil('2027-11-06', '2026-11-06'), 365);
  assert.strictEqual(L.daysUntil('2028-02-29', '2028-02-28'), 1); // leap day
  assert.strictEqual(L.daysUntil('2028-03-01', '2028-02-28'), 2);
  assert.strictEqual(L.daysUntil('not-a-date', '2026-11-06'), null);
  assert.strictEqual(L.daysUntil('2026-02-30', '2026-11-06'), null); // invalid day
  assert.strictEqual(L.daysUntil('2026-13-01', '2026-11-06'), null); // invalid month
});
check('expiryStatus thresholds (180-day renew rule)', () => {
  assert.strictEqual(L.expiryStatus(-5), 'expired');
  assert.strictEqual(L.expiryStatus(0), 'today');
  assert.strictEqual(L.expiryStatus(1), 'renew');
  assert.strictEqual(L.expiryStatus(180), 'renew');
  assert.strictEqual(L.expiryStatus(181), 'ok');
  assert.strictEqual(L.expiryStatus(900), 'ok');
  assert.strictEqual(L.expiryStatus(null), null);
});
check('parseDate rejects malformed dates', () => {
  assert.strictEqual(L.parseDate('2026-2-3'), null);
  assert.strictEqual(L.parseDate('06/11/2026'), null);
  assert.strictEqual(L.parseDate(20261106), null);
  assert.ok(L.parseDate('2026-11-06') instanceof Date);
});

// 4. Checklist definitions.
check('checklist types cover all four application types', () => {
  assert.deepStrictEqual(L.CHECKLIST_TYPES, ['new', 'renewal', 'lost', 'child']);
  assert.strictEqual(L.CHECKLISTS.new.length, 6);
  assert.strictEqual(L.CHECKLISTS.renewal.length, 5);
  assert.strictEqual(L.CHECKLISTS.lost.length, 5);
  assert.strictEqual(L.CHECKLISTS.child.length, 5);
  // every checklist id has an i18n string in both languages
  for (const type of L.CHECKLIST_TYPES) {
    for (const id of L.CHECKLISTS[type]) {
      assert.ok(I18n.STR.en['item_' + id], 'missing EN item_' + id);
      assert.ok(I18n.STR.bn['item_' + id], 'missing BN item_' + id);
    }
  }
});

// 5. Entry validation.
check('validateEntry catches empty label / bad date', () => {
  assert.deepStrictEqual(L.validateEntry('', '2030-01-01'), ['label']);
  assert.deepStrictEqual(L.validateEntry('   ', '2030-01-01'), ['label']);
  assert.deepStrictEqual(L.validateEntry('Mine', 'bad'), ['expiry']);
  assert.deepStrictEqual(L.validateEntry('Mine', '2030-01-01'), []);
  assert.deepStrictEqual(L.validateEntry('x'.repeat(61), '2030-01-01'), ['label-long']);
});

// 6. Import validation.
check('validateImport accepts a good file and rejects bad ones', () => {
  const good = { app: 'passport-guide-bd', version: 1,
    checklist: { new: ['nid', 'form'] }, passports: [{ label: 'Mine', expiry: '2030-05-01' }] };
  assert.strictEqual(L.validateImport(good), null);
  assert.strictEqual(L.validateImport({ app: 'passport-guide-bd', version: 1 }), null);
  assert.strictEqual(L.validateImport(null), 'not-object');
  assert.strictEqual(L.validateImport([]), 'not-object');
  assert.strictEqual(L.validateImport({ app: 'other', version: 1 }), 'bad-app');
  assert.strictEqual(L.validateImport({ app: 'passport-guide-bd' }), 'bad-version');
  assert.strictEqual(L.validateImport({ app: 'passport-guide-bd', version: 1, checklist: { nope: [] } }), 'bad-checklist-type');
  assert.strictEqual(L.validateImport({ app: 'passport-guide-bd', version: 1, checklist: { new: ['nope'] } }), 'bad-checklist-item');
  assert.strictEqual(L.validateImport({ app: 'passport-guide-bd', version: 1, passports: [{ label: '', expiry: '2030-01-01' }] }), 'bad-passport');
  assert.strictEqual(L.validateImport({ app: 'passport-guide-bd', version: 1, passports: 'x' }), 'bad-passports');
});

// 7. i18n parity.
check('i18n EN/BN keys match exactly', () => {
  const en = Object.keys(I18n.STR.en).sort();
  const bn = Object.keys(I18n.STR.bn).sort();
  assert.deepStrictEqual(bn, en);
  for (const k of en) {
    assert.ok(typeof I18n.STR.en[k] === 'string' && I18n.STR.en[k].length > 0, 'empty EN ' + k);
    assert.ok(typeof I18n.STR.bn[k] === 'string' && I18n.STR.bn[k].length > 0, 'empty BN ' + k);
  }
  // 7 steps present in both languages
  for (let i = 1; i <= 7; i++) {
    assert.ok(I18n.STR.en['step' + i + 't'] && I18n.STR.en['step' + i + 'd']);
    assert.ok(I18n.STR.bn['step' + i + 't'] && I18n.STR.bn['step' + i + 'd']);
  }
});

// 8. Money formatting.
check('formatBDT formats with taka sign and grouping', () => {
  assert.strictEqual(L.formatBDT(4025), '\u09f34,025');
  assert.strictEqual(L.formatBDT(13800), '\u09f313,800');
});

console.log('\n' + passed + '/' + passed + ' unit tests passed');
