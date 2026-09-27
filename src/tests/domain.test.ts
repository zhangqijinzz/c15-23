import { describe, expect, it } from 'vitest';
import { estimateDevice, summarizeScenario, usageDaysPerWeek, validateDevice } from '../domain';
import type { EnergyScenario } from '../types';

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
    expect(summary.devices.map((device) => device.share)).toEqual([0.25, 0.75]);
  });

  it('rejects negative power and more than 24 hours', () => {
    expect(validateDevice({ name: 'x', watts: -1, dailyHours: 1 })).toBe('功率不能为负数');
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 24.1 })).toBe('每日使用时间不能超过 24 小时');
  });

  it('scales monthly usage by the weekly pattern', () => {
    const weekdays = estimateDevice({ id: 'a', name: '台灯', watts: 1000, dailyHours: 2, usage: { kind: 'weekdays' } }, 30, 0.5);
    expect(weekdays.monthlyKwh).toBeCloseTo((60 * 5) / 7, 10);
    expect(weekdays.dailyKwh).toBeCloseTo(weekdays.monthlyKwh / 30, 10);
    expect(weekdays.monthlyCost).toBeCloseTo(weekdays.monthlyKwh * 0.5, 10);

    const twiceAWeek = estimateDevice({ id: 'b', name: '洗衣机', watts: 500, dailyHours: 1, usage: { kind: 'timesPerWeek', timesPerWeek: 2 } }, 28, 1);
    expect(twiceAWeek.monthlyKwh).toBeCloseTo(4, 10);
    expect(twiceAWeek.dailyKwh).toBeCloseTo(4 / 28, 10);
  });

  it('treats a missing pattern and an explicit daily pattern identically', () => {
    const legacy = estimateDevice({ id: 'a', name: '冰箱', watts: 150, dailyHours: 10 }, 30, 0.5);
    expect(legacy).toEqual({ dailyKwh: 1.5, monthlyKwh: 45, monthlyCost: 22.5 });
    const explicitDaily = estimateDevice({ id: 'a', name: '冰箱', watts: 150, dailyHours: 10, usage: { kind: 'daily' } }, 30, 0.5);
    expect(explicitDaily).toEqual(legacy);
    expect(usageDaysPerWeek({})).toBe(7);
    expect(usageDaysPerWeek({ usage: { kind: 'weekdays' } })).toBe(5);
    expect(usageDaysPerWeek({ usage: { kind: 'timesPerWeek', timesPerWeek: 3 } })).toBe(3);
  });

  it('derives shares and totals from pattern-adjusted monthly kWh', () => {
    const scenario: EnergyScenario = { id: 's', name: 'test', pricePerKwh: 1, daysPerMonth: 7, createdAt: '', devices: [
      { id: 'a', name: '每天', watts: 1000, dailyHours: 1 },
      { id: 'b', name: '工作日', watts: 1000, dailyHours: 1, usage: { kind: 'weekdays' } },
    ] };
    const summary = summarizeScenario(scenario);
    expect(summary.total.monthlyKwh).toBeCloseTo(12, 10);
    expect(summary.devices[0].share).toBeCloseTo(7 / 12, 10);
    expect(summary.devices[1].share).toBeCloseTo(5 / 12, 10);
    expect(summary.total.dailyKwh).toBeCloseTo(12 / 7, 10);
  });

  it('blocks contradictory weekly patterns with an explanation', () => {
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 1, usage: { kind: 'timesPerWeek', timesPerWeek: 0 } })).toContain('每周使用次数');
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 1, usage: { kind: 'timesPerWeek', timesPerWeek: 8 } })).toContain('每周使用次数');
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 1, usage: { kind: 'timesPerWeek' } })).toBe('请填写每周使用次数');
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 1, usage: { kind: 'timesPerWeek', timesPerWeek: 3 } })).toBeNull();
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 1, usage: { kind: 'weekdays' } })).toBeNull();
  });
});
