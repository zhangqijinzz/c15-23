import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exampleScenario } from '../domain';
import type { EnergyDocument } from '../types';
import { EnergyLensViewModel } from '../viewModel';
import type { EnergyRepository } from '../repository';

function makeRepository(): EnergyRepository & { data: EnergyDocument; save: ReturnType<typeof vi.fn> } {
  const data: EnergyDocument = { version: 1, scenarios: [structuredClone(exampleScenario)], activeScenarioId: exampleScenario.id };
  return { data, load: () => data, save: vi.fn((next: EnergyDocument) => { data.scenarios = next.scenarios; data.activeScenarioId = next.activeScenarioId; }) };
}

describe('EnergyLensViewModel', () => {
  let repository: ReturnType<typeof makeRepository>;
  let vm: EnergyLensViewModel;
  beforeEach(() => { repository = makeRepository(); vm = new EnergyLensViewModel(repository); vm.initialize(); });

  it('initializes, persists edits, and recalculates results', () => {
    expect(vm.getState().status).toBe('ready');
    const before = vm.activeSummary?.total.monthlyKwh;
    vm.updateDevice('device-aircon', { dailyHours: 2 });
    expect(vm.activeSummary?.total.monthlyKwh).toBeLessThan(before ?? Infinity);
    expect(repository.save).toHaveBeenCalled();
  });

  it('keeps invalid values out of the document and exposes an error notice', () => {
    vm.updateDevice('device-aircon', { watts: -50 });
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toBe('功率不能为负数');
    expect(vm.activeScenario?.devices[0].watts).toBe(1200);
  });

  it('duplicates a scenario and can recover a saved document', () => {
    vm.duplicateActive();
    expect(vm.getState().document?.scenarios).toHaveLength(2);
    const recovered = new EnergyLensViewModel(repository);
    recovered.initialize();
    expect(recovered.getState().document?.scenarios).toHaveLength(2);
  });

  it('surfaces persistence failure as a recoverable error', () => {
    repository.save.mockImplementation(() => { throw new Error('quota'); });
    vm.addDevice();
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toContain('保存失败');
  });

  it('applies a weekly schedule and prorates every derived figure', () => {
    const before = vm.activeSummary?.total.monthlyKwh ?? 0;
    vm.updateDevice('device-aircon', { schedule: { mode: 'weekdays' } });
    const aircon = vm.activeSummary?.devices.find((item) => item.id === 'device-aircon');
    expect(aircon?.usageDaysPerWeek).toBe(5);
    expect(aircon?.weeklyHours).toBe(30);
    expect(vm.activeSummary?.total.monthlyKwh).toBeLessThan(before);
  });

  it('accepts a fixed times-per-week pattern and prorates by times/7', () => {
    vm.updateDevice('device-washer', { schedule: { mode: 'weekly', timesPerWeek: 2 } });
    const washer = vm.activeSummary?.devices.find((item) => item.id === 'device-washer');
    expect(washer?.usageDaysPerWeek).toBe(2);
    // 0.5 kWh/次 × 2 次/周 ÷ 7 × 30 天
    expect(washer?.monthlyKwh).toBeCloseTo((0.5 * 2 * 30) / 7);
  });

  it('blocks a contradictory times-per-week value before persisting', () => {
    const original = JSON.stringify(vm.activeScenario?.devices);
    vm.updateDevice('device-aircon', { schedule: { mode: 'weekly', timesPerWeek: 9 } });
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toContain('1–7');
    expect(repository.save).not.toHaveBeenCalled();
    expect(JSON.stringify(vm.activeScenario?.devices)).toBe(original);
  });
});
