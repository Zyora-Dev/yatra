export type BudgetInput = {
  days: number; nights: number; travellers: number; rooms: number;
  stay: number; food: number; transport: number; activities: number; journey: number;
};

export type TripCheckInput = {
  days: number; dailyHours: number; breakHours: number; visitHours: number;
  stops: number | null; transferHours: number | null;
  spendingLimit: number | null; estimatedTotal: number | null; upperEstimate: number | null;
};

export function assessTrip(input: TripCheckInput) {
  if (Object.values(input).some((value) => value !== null && (!Number.isFinite(value) || value < 0))
    || !Number.isInteger(input.days) || input.days < 1 || input.days > 60
    || input.dailyHours <= 0 || input.dailyHours > 16 || input.breakHours >= input.dailyHours
    || input.visitHours <= 0 || input.visitHours > 24
    || (input.stops !== null && (!Number.isInteger(input.stops) || input.stops > 300))
    || input.spendingLimit === 0) throw new RangeError("Check the trip amounts and time allowances.");
  const availableHours = input.days * input.dailyHours;
  const requiredHours = input.stops === null || input.transferHours === null ? null
    : input.stops * input.visitHours + input.transferHours + input.days * input.breakHours;
  const timeStatus = requiredHours === null ? "missing" : requiredHours > availableHours ? "over" : "within";
  const budgetStatus = input.spendingLimit === null || input.estimatedTotal === null ? "missing"
    : input.estimatedTotal > input.spendingLimit ? "over"
    : input.upperEstimate !== null && input.upperEstimate > input.spendingLimit ? "tight" : "within";
  const maxStops = input.transferHours === null ? null
    : Math.max(0, Math.floor((availableHours - input.transferHours - input.days * input.breakHours) / input.visitHours));
  const transferOverload = input.transferHours !== null && input.transferHours + input.days * input.breakHours > availableHours;
  return { availableHours, requiredHours, timeStatus, budgetStatus, maxStops, transferOverload };
}

export function calculateBudget(input: BudgetInput) {
  if (Object.values(input).some((value) => !Number.isFinite(value) || value < 0)
    || input.days < 1 || input.travellers < 1 || input.rooms < 1
    || [input.days, input.nights, input.travellers, input.rooms].some((value) => !Number.isInteger(value))) {
    throw new RangeError("Enter valid non-negative estimates and whole-number trip counts.");
  }
  const breakdown = {
    stay: input.stay * input.nights * input.rooms,
    food: input.food * input.days * input.travellers,
    transport: input.transport * input.days,
    activities: input.activities * input.travellers,
    journey: input.journey,
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total)) throw new RangeError("Estimate is too large.");
  return { breakdown, total, perPerson: total / input.travellers };
}