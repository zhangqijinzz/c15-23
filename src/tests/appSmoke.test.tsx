// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { DeviceEditor } from '../components/DeviceEditor';
import { ScenarioCard } from '../components/ScenarioCard';
import { exampleScenario, summarizeScenario } from '../domain';
import type { EnergyDevice } from '../types';

describe('component smoke render', () => {
  const base: EnergyDevice = { id: 'd', name: '洗衣机', watts: 500, dailyHours: 1, schedule: { mode: 'weekly', timesPerWeek: 3 } };
  const noop = () => {};

  it('renders the weekly-times editor', () => {
    const html = renderToStaticMarkup(createElement(DeviceEditor, { device: base, daysPerMonth: 30, onChange: noop, onRemove: noop }));
    expect(html).toContain('使用规律（按周）');
    expect(html).toContain('次 / 周');
    expect(html).toContain('每周 3 次');
  });

  it('renders the weekdays editor for legacy devices', () => {
    const legacy: EnergyDevice = { id: 'd', name: '老设备', watts: 100, dailyHours: 2 };
    const html = renderToStaticMarkup(createElement(DeviceEditor, { device: legacy, daysPerMonth: 30, onChange: noop, onRemove: noop }));
    expect(html).toContain('每天都用');
  });

  it('scenario cards render prorated totals', () => {
    const summary = summarizeScenario(exampleScenario);
    const html = renderToStaticMarkup(createElement(ScenarioCard, { scenario: exampleScenario, totalKwh: summary.total.monthlyKwh, active: true, onSelect: noop }));
    expect(html).toContain('kWh / 月');
  });
});
