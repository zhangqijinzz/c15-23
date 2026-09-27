import { describe, expect, it } from 'vitest';
import {
  avgDaysPerMonth,
  cloneScenario,
  deviceMonthlyKwh,
  estimateDevice,
  monthlySavingsPerDailyHour,
  summarizeScenario,
  usageDaysPerWeek,
  validateDevice,
  validateSchedule,
  weeklyHours,
} from '../domain';
import type { EnergyDevice, EnergyScenario } from '../types';

function device(partial: Partial<EnergyDevice> = {}): EnergyDevice {
  return { id: 'a', name: '设备', watts: 1000, dailyHours: 2, ...partial };
}

describe('energy domain', () => {
  it('calculates kWh and cost from watts, hours, days and price', () => {
    const result = estimateDevice({ id: 'a', name: '空调', watts: 1000, dailyHours: 2 }, 30, 0.5);
    expect(result).toEqual({ dailyKwh: 2, monthlyKwh: 60, monthlyCost: 30 });
  });

  it('keeps device shares explainable and sums to 100%', () => {
    const scenario: EnergyScenario = { id: 's', name: 'test', pricePerKwh: 1, daysPerMonth: 30, createdAt: '', devices: [
      { id: 'a', name: 'a', watts: 100, dailyHours: 1 }, { id: 'b', name: 'b', watts: 300, dailyHours: 1 },
    ] };
    const summary = summarizeScenario(scenario);
    expect(summary.total.monthlyKwh).toBe(12);
    expect(summary.devices.map((item) => item.share)).toEqual([0.25, 0.75]);
  });

  it('rejects negative power and more than 24 hours', () => {
    expect(validateDevice({ name: 'x', watts: -1, dailyHours: 1 })).toBe('功率不能为负数');
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 24.1 })).toBe('每日使用时间不能超过 24 小时');
  });

  it('treats legacy devices without a schedule as used every day, keeping old results', () => {
    const legacy = device();
    expect(usageDaysPerWeek(legacy)).toBe(7);
    expect(deviceMonthlyKwh(legacy, 30)).toBe(60);
    const summary = estimateDevice(legacy, 30, 0.5);
    expect(summary).toEqual({ dailyKwh: 2, monthlyKwh: 60, monthlyCost: 30 });
  });

  it('treats an explicit daily schedule exactly like legacy data', () => {
    expect(deviceMonthlyKwh(device({ schedule: { mode: 'daily' } }), 30)).toBe(60);
  });

  it('prorates weekday-only devices by 5/7', () => {
    const lamp = device({ watts: 12, dailyHours: 5, schedule: { mode: 'weekdays' } });
    expect(usageDaysPerWeek(lamp)).toBe(5);
    expect(weeklyHours(lamp)).toBe(25);
    expect(avgDaysPerMonth(lamp, 30)).toBeCloseTo(150 / 7);
    expect(deviceMonthlyKwh(lamp, 30)).toBeCloseTo((12 * 5 / 1000) * (5 / 7) * 30);
    expect(estimateDevice(lamp, 28, 1).dailyKwh).toBeCloseTo(0.012 * 5 * 5 / 7);
  });

  it('prorates devices used a fixed number of times per week', () => {
    const washer = device({ watts: 500, dailyHours: 1, schedule: { mode: 'weekly', timesPerWeek: 3 } });
    expect(usageDaysPerWeek(washer)).toBe(3);
    // 0.5 kWh/次 × 3 次/周 × 4 周（28 天）= 6 kWh
    expect(deviceMonthlyKwh(washer, 28)).toBeCloseTo(6);
  });

  it('exposes weekly bookkeeping fields on every summary device', () => {
    const scenario: EnergyScenario = { id: 's', name: 'test', pricePerKwh: 1, daysPerMonth: 28, createdAt: '', devices: [
      device({ id: 'fridge', name: '冰箱', watts: 100, dailyHours: 24 }),
      device({ id: 'lamp', name: '台灯', watts: 100, dailyHours: 4, schedule: { mode: 'weekdays' } }),
    ] };
    const [fridge, lamp] = summarizeScenario(scenario).devices;
    expect(fridge.usageDaysPerWeek).toBe(7);
    expect(fridge.weeklyHours).toBe(168);
    expect(fridge.avgDaysPerMonth).toBe(28);
    expect(lamp.usageDaysPerWeek).toBe(5);
    expect(lamp.weeklyHours).toBe(20);
    expect(lamp.avgDaysPerMonth).toBe(20);
  });

  it('bases savings insights on prorated days instead of a hardcoded month', () => {
    const washer = device({ watts: 1000, schedule: { mode: 'weekly', timesPerWeek: 2 } });
    // 每个使用日少开 1 小时：1 kWh × (2/7 × 28) 天 × 0.6 元 = 4.8 元
    expect(monthlySavingsPerDailyHour(washer, 28, 0.6)).toBeCloseTo(4.8);
  });

  it('rejects contradictory weekly patterns with explanatory messages', () => {
    expect(validateSchedule(2, { mode: 'weekly', timesPerWeek: 0 })).toContain('1–7');
    expect(validateSchedule(2, { mode: 'weekly', timesPerWeek: 2.5 })).toContain('整数');
    expect(validateSchedule(2, { mode: 'weekly', timesPerWeek: 8 })).toContain('1–7');
    // 规律与时长组合不能超过物理上的一周 168 小时
    expect(validateSchedule(40, { mode: 'weekdays' })).toContain('每周最多 168 小时');
    expect(validateDevice(device({ dailyHours: 24, schedule: { mode: 'weekly', timesPerWeek: 8 } }))).toContain('1–7');
    // 自洽的规律应放行
    expect(validateSchedule(24, { mode: 'daily' })).toBeNull();
    expect(validateSchedule(24, { mode: 'weekdays' })).toBeNull();
    expect(validateSchedule(24, { mode: 'weekly', timesPerWeek: 7 })).toBeNull();
  });

  it('copies weekly schedules when duplicating a scenario without sharing references', () => {
    const scenario: EnergyScenario = { id: 's', name: 'test', pricePerKwh: 1, daysPerMonth: 30, createdAt: '', devices: [
      device({ id: 'a', schedule: { mode: 'weekly', timesPerWeek: 2 } }),
    ] };
    const copy = cloneScenario(scenario, 'copy', '副本');
    expect(copy.devices[0].schedule).toEqual({ mode: 'weekly', timesPerWeek: 2 });
    expect(copy.devices[0].schedule).not.toBe(scenario.devices[0].schedule);
    // 旧设备（无 schedule）复制后仍按每天都用
    const legacy: EnergyScenario = { ...scenario, devices: [device({ id: 'b' })] };
    expect(cloneScenario(legacy, 'copy2', '副本2').devices[0].schedule).toBeUndefined();
  });
});
