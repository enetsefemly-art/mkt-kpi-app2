export interface KpiScoreParams {
  kpiType: string;
  direction: string;
  target: number | null;
  actual: number | null;
  manualProgress: number | null;
  kpiWeight: number;
  subWeight: number;
}

export interface KpiScoreResult {
  ratio: number;
  cappedRatio: number;
  weightedScore: number;
}

export function calcItemScore(params: KpiScoreParams): KpiScoreResult {
  const { kpiType, direction, target, actual, manualProgress, kpiWeight, subWeight } = params;

  let ratio = 0;

  if (kpiType === 'strategic') {
    // Strategic: use manual progress (0..1)
    // If manualProgress is null, treat as 0
    ratio = manualProgress ?? 0;
  } else {
    // Quantitative: Revenue, Cost, Lead, Rate
    const t = target ?? 0;
    const a = actual ?? 0;

    if (direction === 'lower_better' || kpiType === 'cost') {
      // Lower is better: Target / Actual
      if (a === 0) {
        // Avoid division by zero. 
        // If target is also 0, it's 100%. If target > 0, it's infinite (perfect?). 
        // Usually actual=0 for cost is good, but let's cap or handle logic.
        // For simplicity: if target > 0 and actual = 0, ratio = 1.2 (max cap) or just 1.
        // Let's assume actual=0 is perfect if target > 0.
        ratio = t === 0 ? 1 : 2.0; // 2.0 will be capped to 1.2
      } else {
        ratio = t / a;
      }
    } else {
      // Higher is better: Actual / Target
      if (t === 0) {
        // If target is 0. 
        // If actual > 0, it's infinite. 
        // If actual = 0, it's 100%.
        ratio = a === 0 ? 1 : 2.0;
      } else {
        ratio = a / t;
      }
    }
  }

  // Cap at 1.2 (120%)
  // Ensure ratio is not negative (though inputs should be positive)
  const safeRatio = Math.max(0, ratio);
  const cappedRatio = Math.min(safeRatio, 1.2);

  // Weighted Score = Capped Ratio * (KPI Weight * Sub Weight / 100)
  // KPI Weight is typically 0-100 (percentage), Sub Weight is 0-100 (percentage)
  // Result is in percentage points contribution to total score
  // Example: KPI Weight 20%, Sub Weight 50%, Ratio 1.0 => 1.0 * 20 * 0.5 = 10 points
  const weightedScore = cappedRatio * (kpiWeight * (subWeight / 100));

  return {
    ratio: safeRatio,
    cappedRatio,
    weightedScore
  };
}
