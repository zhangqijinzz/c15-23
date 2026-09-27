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

  it('recalculates totals and shares when a weekly pattern changes', () => {
    const before = vm.activeSummary?.total.monthlyKwh ?? Infinity;
    vm.updateDevice('device-aircon', { usage: { kind: 'weekdays' } });
    const summary = vm.activeSummary;
    const aircon = summary?.devices.find((device) => device.id === 'device-aircon');
    expect(aircon?.monthlyKwh).toBeCloseTo(((1200 * 6) / 1000) * ((30 * 5) / 7), 10);
    expect(summary?.total.monthlyKwh).toBeLessThan(before);
    expect(aircon?.share).toBeCloseTo((aircon?.monthlyKwh ?? 0) / (summary?.total.monthlyKwh ?? 1), 10);
    expect(repository.save).toHaveBeenCalled();
  });

  it('blocks contradictory patterns and keeps the saved device untouched', () => {
    vm.updateDevice('device-aircon', { usage: { kind: 'timesPerWeek', timesPerWeek: 9 } });
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toContain('每周使用次数');
    expect(vm.activeScenario?.devices[0].usage).toBeUndefined();
  });

  it('keeps results identical for saved scenarios without usage patterns', () => {
    // 示例方案的设备没有 usage 字段，折算结果必须与旧公式一致
    expect(vm.activeSummary?.total.monthlyKwh).toBeCloseTo(((1200 * 6 + 150 * 10 + 12 * 5) / 1000) * 30, 10);
    expect(vm.activeSummary?.total.dailyKwh).toBeCloseTo((1200 * 6 + 150 * 10 + 12 * 5) / 1000, 10);
  });
});
