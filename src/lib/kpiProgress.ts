export function getDaysInMonth(monthKey?: string): number {
  const date = monthKey ? new Date(`${monthKey}-01T00:00:00Z`) : new Date();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function getCurrentDayInMonth(monthKey?: string): number {
  const now = new Date();
  const currentMonthKey = now.toISOString().slice(0, 7);
  
  if (!monthKey || monthKey === currentMonthKey) {
    return now.getUTCDate();
  }
  
  if (monthKey < currentMonthKey) {
    return getDaysInMonth(monthKey);
  }
  
  return 1;
}

export function calcTargetToDate(params: {
  target: number | null;
  targetMode: "fixed" | "cumulative";
  currentDay: number;
  totalDays: number;
}): number | null {
  const { target, targetMode, currentDay, totalDays } = params;
  if (target === null) return null;
  if (targetMode === "fixed") return target;
  return target * (currentDay / totalDays);
}

export function calcRawRatio(params: {
  actual: number | null;
  targetToDate: number | null;
  direction?: string;
}): number | null {
  const { actual, targetToDate, direction = "higher_better" } = params;
  if (targetToDate === null || targetToDate === 0) return null;
  
  if (direction === "higher_better") {
    return (actual || 0) / targetToDate;
  } else {
    if (actual === null || actual <= 0) return null;
    return targetToDate / actual;
  }
}

export function calcNormalizedRatio(rawRatio: number | null): number | null {
  if (rawRatio === null) return null;
  if (rawRatio < 0.8) return 0.8;
  if (rawRatio > 1.2) return 1.2;
  return rawRatio;
}

export function calcScoreItem(params: {
  normalizedRatio: number | null;
  subWeight: number | null;
}): number | null {
  const { normalizedRatio, subWeight } = params;
  if (normalizedRatio === null || subWeight === null) return null;
  return normalizedRatio * subWeight;
}

export function getProgressStatus(rawRatio: number | null): "critical" | "warning" | "healthy" | "unknown" {
  if (rawRatio === null) return "unknown";
  if (rawRatio < 0.8) return "critical";
  if (rawRatio >= 0.8 && rawRatio < 1) return "warning";
  return "healthy";
}

export function calcTotalKpiScore(items: any[]): number {
  return items.reduce((sum, item) => {
    if (item.scoreItem != null) {
      return sum + item.scoreItem;
    }
    return sum;
  }, 0);
}

export function validateSubWeightTotal(items: any[]) {
  const total = items.reduce((sum, item) => sum + (Number(item.sub_weight) || 0), 0);
  const isOver = total > 100;
  const isUnder = total < 100;
  const isExact = total === 100;
  
  let message = null;
  if (isOver) {
    message = "Tổng subweight của các KPI items trong cùng KPI không được vượt quá 100%.";
  } else if (isUnder) {
    message = "Tổng subweight hiện tại chưa đủ 100%, điểm KPI có thể chưa phản ánh đầy đủ.";
  }
  
  return {
    total,
    isOver,
    isExact,
    isUnder,
    message
  };
}
