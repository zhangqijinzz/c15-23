// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { exampleScenario } from '../domain';
import { LocalEnergyRepository } from '../repository';

describe('local persistence recovery', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to a valid example when saved JSON is damaged', () => {
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [null], activeScenarioId: 'missing' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
    expect(recovered.scenarios[0].devices.length).toBeGreaterThan(0);
  });

  it('round-trips devices that carry a weekly usage pattern', () => {
    const repository = new LocalEnergyRepository();
    const document = {
      version: 1 as const,
      activeScenarioId: exampleScenario.id,
      scenarios: [{ ...exampleScenario, devices: [
        { id: 'device-washer', name: '洗衣机', watts: 500, dailyHours: 1, usage: { kind: 'timesPerWeek' as const, timesPerWeek: 3 } },
        { id: 'device-fridge', name: '冰箱', watts: 150, dailyHours: 10 },
      ] }],
    };
    repository.save(document);
    const recovered = repository.load();
    expect(recovered.scenarios[0].devices[0].usage).toEqual({ kind: 'timesPerWeek', timesPerWeek: 3 });
    expect(recovered.scenarios[0].devices[1].usage).toBeUndefined();
  });

  it('falls back when a saved usage pattern contradicts itself', () => {
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({
      version: 1,
      activeScenarioId: 's1',
      scenarios: [{ id: 's1', name: 'x', createdAt: '', pricePerKwh: 0.5, daysPerMonth: 30, devices: [
        { id: 'd', name: 'd', watts: 1, dailyHours: 1, usage: { kind: 'timesPerWeek', timesPerWeek: 99 } },
      ] }],
    }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
  });
});
