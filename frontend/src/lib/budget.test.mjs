import test from "node:test";
import assert from "node:assert/strict";
import { assessTrip, calculateBudget } from "./budget.ts";

const trip = { days: 3, nights: 2, travellers: 2, rooms: 1, stay: 100, food: 20, transport: 30, activities: 10, journey: 50 };
const check = { days: 3, dailyHours: 6, breakHours: 1, visitHours: 2, stops: 6, transferHours: 3, spendingLimit: 500, estimatedTotal: 480, upperEstimate: 490 };
test("trip check fits exact time and spending boundaries", () => {
  const result = assessTrip(check);
  assert.equal(result.requiredHours, 18);
  assert.equal(result.timeStatus, "within");
  assert.equal(result.budgetStatus, "within");
  assert.equal(assessTrip({ ...check, spendingLimit: 480, upperEstimate: 480 }).budgetStatus, "within");
});
test("overloaded plans recommend a stop count that fits the declared hours", () => {
  const result = assessTrip({ ...check, stops: 12, spendingLimit: 400 });
  assert.equal(result.timeStatus, "over");
  assert.equal(result.budgetStatus, "over");
  assert.equal(result.maxStops, 6);
  assert.equal(assessTrip({ ...check, stops: result.maxStops }).timeStatus, "within");
  assert.equal(assessTrip({ ...check, transferHours: 20 }).transferOverload, true);
});
test("uncertain upper costs and missing inputs never receive a verified verdict", () => {
  assert.equal(assessTrip({ ...check, upperEstimate: 600 }).budgetStatus, "tight");
  const result = assessTrip({ ...check, stops: null, transferHours: null, spendingLimit: null, estimatedTotal: null });
  assert.equal(result.timeStatus, "missing");
  assert.equal(result.budgetStatus, "missing");
  assert.equal(result.requiredHours, null);
  assert.equal(assessTrip({ ...check, stops: 0, transferHours: 0 }).timeStatus, "within");
});
test("trip check rejects invalid and non-finite inputs", () => {
  for (const invalid of [{ days: 0 }, { days: 1.5 }, { dailyHours: 25 }, { breakHours: 6 }, { visitHours: 0 }, { stops: 1.5 }, { transferHours: -1 }, { spendingLimit: 0 }, { estimatedTotal: Infinity }, { upperEstimate: NaN }]) {
    assert.throws(() => assessTrip({ ...check, ...invalid }), RangeError);
  }
});
test("budget multiplies person, room, day and trip costs separately", () => {
  assert.deepEqual(calculateBudget(trip), { breakdown: { stay: 200, food: 120, transport: 90, activities: 20, journey: 50 }, total: 480, perPerson: 240 });
});
test("day trips and explicit zero estimates are allowed", () => {
  assert.equal(calculateBudget({ ...trip, nights: 0, food: 0, transport: 0, activities: 0, journey: 0 }).total, 0);
});
test("invalid counts and non-finite estimates are rejected", () => {
  for (const invalid of [{ travellers: 0 }, { days: 1.5 }, { stay: -1 }, { journey: Infinity }, { food: NaN }]) {
    assert.throws(() => calculateBudget({ ...trip, ...invalid }), RangeError);
  }
});