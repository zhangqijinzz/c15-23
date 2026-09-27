// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { exampleScenario, summarizeScenario } from '../domain';
import { LocalEnergyRepository } from '../repository';
import type { EnergyDocument } from '../types';

describe('local persistence recovery', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to a valid example when saved JSON is damaged', () => {
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [null], activeScenarioId: 'missing' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
    expect(recovered.scenarios[0].devices.length).toBeGreaterThan(0);
  });

  it('loads legacy devices without a weekly schedule and keeps their results unchanged', () => {
    const legacyDoc: EnergyDocument = {
      version: 1,
      activeScenarioId: 'legacy',
      scenarios: [{
        id: 'legacy', name: '旧方案', pricePerKwh: 0.6, daysPerMonth: 30, createdAt: '',
        devices: [
          { id: 'd1', name: '老空调', watts: 1000, dailyHours: 2 },
          { id: 'd2', name: '老台灯', watts: 10, dailyHours: 5 },
        ],
      }],
    };
    localStorage.setItem('energy-lens.document.v1', JSON.stringify(legacyDoc));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios).toHaveLength(1);
    // 旧设备按每天都用：(1000×2 + 10×5) × 30 ÷ 1000 = 61.5 kWh
    expect(summarizeScenario(recovered.scenarios[0]).total.monthlyKwh).toBeCloseTo(61.5);
  });

  it('loads devices carrying a weekly schedule', () => {
    const doc: EnergyDocument = {
      version: 1,
      activeScenarioId: 's1',
      scenarios: [{
        id: 's1', name: '新方案', pricePerKwh: 0.6, daysPerMonth: 28, createdAt: '',
        devices: [
          { id: 'fridge', name: '冰箱', watts: 100, dailyHours: 24, schedule: { mode: 'daily' } },
          { id: 'lamp', name: '台灯', watts: 20, dailyHours: 4, schedule: { mode: 'weekdays' } },
          { id: 'washer', name: '洗衣机', watts: 500, dailyHours: 1, schedule: { mode: 'weekly', timesPerWeek: 3 } },
        ],
      }],
    };
    localStorage.setItem('energy-lens.document.v1', JSON.stringify(doc));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios[0].devices).toHaveLength(3);
    const totals = summarizeScenario(recovered.scenarios[0]);
    expect(totals.devices.find((d) => d.id === 'lamp')?.monthlyKwh).toBeCloseTo(0.02 * 4 * 20);
    expect(totals.devices.find((d) => d.id === 'washer')?.monthlyKwh).toBeCloseTo(0.5 * 12);
  });

  it('rejects documents whose weekly schedule contradicts the daily hours', () => {
    const broken = {
      version: 1,
      activeScenarioId: 's1',
      scenarios: [{
        id: 's1', name: '坏方案', pricePerKwh: 0.6, daysPerMonth: 30, createdAt: '',
        devices: [{ id: 'd1', name: '设备', watts: 100, dailyHours: 2, schedule: { mode: 'weekly', timesPerWeek: 9 } }],
      }],
    };
    localStorage.setItem('energy-lens.document.v1', JSON.stringify(broken));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
  });
});
