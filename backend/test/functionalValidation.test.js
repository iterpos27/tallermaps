const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidLatitude, isValidLongitude, normalizeDate, businessDate } = require('../src/utils/validation');
const { validateWorkshopLocation } = require('../src/services/workshopGeofence');
const { validateSlot } = require('../src/controllers/scheduleMutations');

test('GPS rechaza vacíos y tipos inesperados pero acepta cero', () => {
  for (const value of ['', ' ', null, undefined, true, false, [], {}, NaN, Infinity]) {
    assert.equal(isValidLatitude(value), false);
    assert.equal(isValidLongitude(value), false);
  }
  assert.equal(isValidLatitude(0), true);
  assert.equal(isValidLongitude('0'), true);
});
test('calendario estricto y fecha comercial de Ecuador', () => {
  assert.equal(normalizeDate('2026-02-30'), null);
  assert.equal(normalizeDate('2024-02-29'), '2024-02-29');
  assert.equal(businessDate(new Date('2026-09-07T01:00:00Z')), '2026-09-06');
  assert.throws(() => validateSlot('2026-02-30', '10:00', 30));
  assert.throws(() => validateSlot('2026-09-06', '23:50', 30));
  assert.doesNotThrow(() => validateSlot('2026-09-06', '23:30', 30));
});
for (const distance of [0, 49, 50, 51]) {
  test(`geocerca de duplicados: ${distance} metros`, async () => {
    const client = { query: async (sql) => ({ rows: sql.includes('FROM talleres') ? [{ id: 1, latitud: distance / 6371000 * 180 / Math.PI, longitud: -80 }] : [] }) };
    if (distance <= 50) await assert.rejects(validateWorkshopLocation(client, 0, -80), { status: 409 });
    else await assert.doesNotReject(validateWorkshopLocation(client, 0, -80));
  });
}
