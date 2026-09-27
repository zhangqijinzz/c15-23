import type { EnergyDevice, EnergyEstimate, EnergyScenario, ScenarioSummary } from './types';

export const MAX_DAILY_HOURS = 24;
export const DAYS_PER_WEEK = 7;
export const WEEKDAYS_PER_WEEK = 5;
export const MIN_TIMES_PER_WEEK = 1;
export const MAX_TIMES_PER_WEEK = 7;

export const exampleScenario: EnergyScenario = {
  id: 'scenario-home',
  name: '夏日居家方案',
  pricePerKwh: 0.62,
  daysPerMonth: 30,
  createdAt: '2026-01-01T00:00:00.000Z',
  devices: [
    { id: 'device-aircon', name: '客厅空调', watts: 1200, dailyHours: 6 },
    { id: 'device-fridge', name: '冰箱', watts: 150, dailyHours: 10 },
    { id: 'device-lamp', name: '书桌台灯', watts: 12, dailyHours: 5 },
  ],
};

/** 设备每周的实际使用天数，按使用规律折算；未填规律的旧数据视为每天使用。 */
export function usageDaysPerWeek(device: Pick<EnergyDevice, 'usage'>): number {
  const pattern = device.usage;
  if (!pattern || pattern.kind === 'daily') return DAYS_PER_WEEK;
  if (pattern.kind === 'weekdays') return WEEKDAYS_PER_WEEK;
  const times = pattern.timesPerWeek;
  if (typeof times !== 'number' || !Number.isFinite(times)) return DAYS_PER_WEEK;
  return Math.min(Math.max(times, MIN_TIMES_PER_WEEK), MAX_TIMES_PER_WEEK);
}

/** 计费月内的实际使用天数：月天数 × 每周规律折算。 */
export function monthlyActiveDays(device: Pick<EnergyDevice, 'usage'>, daysPerMonth: number): number {
  return (daysPerMonth * usageDaysPerWeek(device)) / DAYS_PER_WEEK;
}

export function estimateDevice(device: EnergyDevice, daysPerMonth: number, pricePerKwh: number): EnergyEstimate {
  const perUseDayKwh = (device.watts * device.dailyHours) / 1000;
  // 每天使用（含未填规律的旧数据）走原始计算路径，保证已保存方案的结果不变
  if (!device.usage || device.usage.kind === 'daily') {
    const monthlyKwh = perUseDayKwh * daysPerMonth;
    return { dailyKwh: perUseDayKwh, monthlyKwh, monthlyCost: monthlyKwh * pricePerKwh };
  }
  const monthlyKwh = perUseDayKwh * monthlyActiveDays(device, daysPerMonth);
  const dailyKwh = daysPerMonth > 0 ? monthlyKwh / daysPerMonth : 0;
  return { dailyKwh, monthlyKwh, monthlyCost: monthlyKwh * pricePerKwh };
}

export function summarizeScenario(scenario: EnergyScenario): ScenarioSummary {
  const devices = scenario.devices.map((device) => ({
    ...device,
    ...estimateDevice(device, scenario.daysPerMonth, scenario.pricePerKwh),
    share: 0,
  }));
  const total = devices.reduce(
    (sum, device) => ({
      dailyKwh: sum.dailyKwh + device.dailyKwh,
      monthlyKwh: sum.monthlyKwh + device.monthlyKwh,
      monthlyCost: sum.monthlyCost + device.monthlyCost,
    }),
    { dailyKwh: 0, monthlyKwh: 0, monthlyCost: 0 },
  );
  return {
    total,
    devices: devices.map((device) => ({ ...device, share: total.monthlyKwh ? device.monthlyKwh / total.monthlyKwh : 0 })),
  };
}

export function validateDevice(device: Pick<EnergyDevice, 'name' | 'watts' | 'dailyHours' | 'usage'>): string | null {
  if (!device.name.trim()) return '请填写设备名称';
  if (!Number.isFinite(device.watts) || device.watts < 0) return '功率不能为负数';
  if (!Number.isFinite(device.dailyHours) || device.dailyHours < 0) return '使用时间不能为负数';
  if (device.dailyHours > MAX_DAILY_HOURS) return '每日使用时间不能超过 24 小时';
  const usage = device.usage;
  if (usage) {
    if (usage.kind !== 'daily' && usage.kind !== 'weekdays' && usage.kind !== 'timesPerWeek') return '未知的使用规律';
    if (usage.kind === 'timesPerWeek') {
      if (typeof usage.timesPerWeek !== 'number' || !Number.isFinite(usage.timesPerWeek)) return '请填写每周使用次数';
      if (usage.timesPerWeek < MIN_TIMES_PER_WEEK || usage.timesPerWeek > MAX_TIMES_PER_WEEK) {
        return `每周使用次数需在 ${MIN_TIMES_PER_WEEK}–${MAX_TIMES_PER_WEEK} 次之间，与一周的天数相符`;
      }
    }
  }
  return null;
}

export function validateScenarioSettings(pricePerKwh: number, daysPerMonth: number): string | null {
  if (!Number.isFinite(pricePerKwh) || pricePerKwh < 0) return '电价不能为负数';
  if (!Number.isFinite(daysPerMonth) || daysPerMonth < 1 || daysPerMonth > 31) return '计费天数需在 1–31 天之间';
  return null;
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function cloneScenario(source: EnergyScenario, id: string, name: string): EnergyScenario {
  return { ...source, id, name, createdAt: new Date().toISOString(), devices: source.devices.map((device) => ({ ...device, id: `${id}-${device.id}`, usage: device.usage ? { ...device.usage } : undefined })) };
}
