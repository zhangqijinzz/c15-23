import type { EnergyDevice, EnergyEstimate, EnergyScenario, ScenarioSummary, WeeklyMode, WeeklySchedule } from './types';

export const MAX_DAILY_HOURS = 24;
export const DAYS_PER_WEEK = 7;
export const WEEKDAY_DAYS_PER_WEEK = 5;
export const MAX_TIMES_PER_WEEK = 7;

const MODE_LABELS: Record<WeeklyMode, string> = {
  daily: '每天',
  weekdays: '工作日',
  weekly: '每周几次',
};

export function scheduleModeLabel(mode: WeeklyMode): string {
  return MODE_LABELS[mode];
}

/** 设备的按周使用规律；旧数据没有 schedule 字段时按“每天都用”处理 */
export function deviceSchedule(device: Pick<EnergyDevice, 'schedule'>): WeeklySchedule {
  return device.schedule ?? { mode: 'daily' };
}

/** 每周实际使用天数：每天=7，工作日=5，每周几次=次数 */
export function usageDaysPerWeek(device: Pick<EnergyDevice, 'schedule'>): number {
  const schedule = deviceSchedule(device);
  if (schedule.mode === 'weekdays') return WEEKDAY_DAYS_PER_WEEK;
  if (schedule.mode === 'weekly') return clampTimesPerWeek(schedule.timesPerWeek);
  return DAYS_PER_WEEK;
}

/** 每周使用小时数（使用天数 × 每个使用日的小时数） */
export function weeklyHours(device: Pick<EnergyDevice, 'dailyHours' | 'schedule'>): number {
  return usageDaysPerWeek(device) * device.dailyHours;
}

/** 折算到每个计费月的等效使用天数 */
export function avgDaysPerMonth(device: Pick<EnergyDevice, 'schedule'>, daysPerMonth: number): number {
  return (usageDaysPerWeek(device) / DAYS_PER_WEEK) * daysPerMonth;
}

function clampTimesPerWeek(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 1;
}

/** 设备月度用电量（kWh）：功率 × 每日时长 ÷ 1000 × 按周折算的等效月天数 */
export function deviceMonthlyKwh(device: Pick<EnergyDevice, 'watts' | 'dailyHours' | 'schedule'>, daysPerMonth: number): number {
  return (device.watts * device.dailyHours) / 1000 * avgDaysPerMonth(device, daysPerMonth);
}

export const exampleScenario: EnergyScenario = {
  id: 'scenario-home',
  name: '夏日居家方案',
  pricePerKwh: 0.62,
  daysPerMonth: 30,
  createdAt: '2026-01-01T00:00:00.000Z',
  devices: [
    { id: 'device-aircon', name: '客厅空调', watts: 1200, dailyHours: 6, schedule: { mode: 'daily' } },
    { id: 'device-fridge', name: '冰箱', watts: 150, dailyHours: 10, schedule: { mode: 'daily' } },
    { id: 'device-washer', name: '洗衣机', watts: 500, dailyHours: 1, schedule: { mode: 'weekly', timesPerWeek: 3 } },
    { id: 'device-lamp', name: '书桌台灯', watts: 12, dailyHours: 5, schedule: { mode: 'weekdays' } },
  ],
};

export function estimateDevice(device: EnergyDevice, daysPerMonth: number, pricePerKwh: number): EnergyEstimate {
  // 日历日均 = 月度结果 ÷ 计费天数，daily/旧设备折算系数为 1，结果与历史一致
  const monthlyKwh = deviceMonthlyKwh(device, daysPerMonth);
  const dailyKwh = monthlyKwh / daysPerMonth;
  return { dailyKwh, monthlyKwh, monthlyCost: monthlyKwh * pricePerKwh };
}

export function summarizeScenario(scenario: EnergyScenario): ScenarioSummary {
  const devices = scenario.devices.map((device) => {
    const estimate = estimateDevice(device, scenario.daysPerMonth, scenario.pricePerKwh);
    return {
      ...device,
      ...estimate,
      share: 0,
      usageDaysPerWeek: usageDaysPerWeek(device),
      weeklyHours: weeklyHours(device),
      avgDaysPerMonth: avgDaysPerMonth(device, scenario.daysPerMonth),
    };
  });
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

export function validateDevice(device: Pick<EnergyDevice, 'name' | 'watts' | 'dailyHours' | 'schedule'>): string | null {
  if (!device.name.trim()) return '请填写设备名称';
  if (!Number.isFinite(device.watts) || device.watts < 0) return '功率不能为负数';
  if (!Number.isFinite(device.dailyHours) || device.dailyHours < 0) return '使用时间不能为负数';
  if (device.dailyHours > MAX_DAILY_HOURS) return '每日使用时间不能超过 24 小时';
  return validateSchedule(device.dailyHours, device.schedule);
}

/** 校验按周规律本身，以及它与每日时长组合后是否超出物理上的一周 168 小时 */
export function validateSchedule(dailyHours: number, schedule?: WeeklySchedule): string | null {
  if (!schedule) return null;
  if (schedule.mode === 'weekly') {
    const times = schedule.timesPerWeek;
    if (times === undefined || !Number.isFinite(times)) return '请填写每周使用次数';
    if (!Number.isInteger(times) || times < 1 || times > MAX_TIMES_PER_WEEK) return '每周使用次数需为 1–7 之间的整数';
  }
  const days = schedule.mode === 'weekdays' ? WEEKDAY_DAYS_PER_WEEK : schedule.mode === 'weekly' ? clampTimesPerWeek(schedule.timesPerWeek) : DAYS_PER_WEEK;
  if (dailyHours * days > MAX_DAILY_HOURS * DAYS_PER_WEEK) {
    return `每周最多 ${MAX_DAILY_HOURS * DAYS_PER_WEEK} 小时：${days} 个使用日 × ${dailyHours} 小时已超出，请减少时长或使用天数`;
  }
  return null;
}

/** 每个使用日少开 1 小时，每月可节省的电费（元） */
export function monthlySavingsPerDailyHour(device: Pick<EnergyDevice, 'watts' | 'schedule'>, daysPerMonth: number, pricePerKwh: number): number {
  return (device.watts / 1000) * avgDaysPerMonth(device, daysPerMonth) * pricePerKwh;
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
  return { ...source, id, name, createdAt: new Date().toISOString(), devices: source.devices.map((device) => ({ ...device, schedule: device.schedule ? { ...device.schedule } : undefined, id: `${id}-${device.id}` })) };
}
