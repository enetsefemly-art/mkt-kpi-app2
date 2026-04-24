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
    ratio = manualProgress ?? 0;
  } else {
    const t = target ?? 0;
    const a = actual ?? 0;

    if (direction === 'lower_better' || kpiType === 'cost') {
      if (a === 0) {
        ratio = t === 0 ? 1 : 2.0; 
      } else {
        ratio = t / a;
      }
    } else {
      if (t === 0) {
        ratio = a === 0 ? 1 : 2.0;
      } else {
        ratio = a / t;
      }
    }
  }

  const safeRatio = Math.max(0, ratio);
  const cappedRatio = Math.min(safeRatio, 1.2);

  // scoreItem is now just the normalized_ratio (cappedRatio)
  // We keep the property name 'weightedScore' for compatibility 
  // with existing code but correctly calculate what it should be
  // Actually no, wait. 'weightedScore' in the table was previously showing normalized_ratio * subWeight.
  // The UI in [kpiId]/page.tsx can just use cappedRatio. Let's return it as `scoreItem` and also `contribution` for sum.
  const scoreItem = cappedRatio;
  
  return {
    ratio: safeRatio,
    cappedRatio,
    weightedScore: scoreItem
  };
}
