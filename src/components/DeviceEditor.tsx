import type { ChangeEvent } from 'react';
import { scheduleModeLabel, usageDaysPerWeek, weeklyHours } from '../domain';
import type { EnergyDevice, WeeklyMode, WeeklySchedule } from '../types';

interface DeviceEditorProps {
  device: EnergyDevice;
  daysPerMonth: number;
  onChange: (patch: Partial<EnergyDevice>) => void;
  onRemove: () => void;
}

const MODES: WeeklyMode[] = ['daily', 'weekdays', 'weekly'];

function currentSchedule(device: EnergyDevice): WeeklySchedule {
  return device.schedule ?? { mode: 'daily' };
}

export function DeviceEditor({ device, daysPerMonth, onChange, onRemove }: DeviceEditorProps) {
  const schedule = currentSchedule(device);
  const mode = schedule.mode;
  const numberChange = (key: 'watts' | 'dailyHours') => (event: ChangeEvent<HTMLInputElement>) => onChange({ [key]: Number(event.target.value) });
  const selectMode = (next: WeeklyMode) => {
    if (next === 'weekly') {
      onChange({ schedule: { mode: 'weekly', timesPerWeek: schedule.timesPerWeek ?? 3 } });
    } else {
      onChange({ schedule: { mode: next } });
    }
  };
  const timesChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange({ schedule: { mode: 'weekly', timesPerWeek: Number(event.target.value) } });
  const hoursSuffix = mode === 'weekly' ? '小时/次' : '小时/天';
  const daysPerWeek = usageDaysPerWeek(device);
  const hint =
    mode === 'weekly'
      ? `每周 ${schedule.timesPerWeek ?? 3} 次，共 ${formatHours(weeklyHours(device))} 小时 · 每月约 ${((daysPerWeek / 7) * daysPerMonth).toFixed(1)} 天`
      : mode === 'weekdays'
        ? `每周 5 天，共 ${formatHours(weeklyHours(device))} 小时 · 每月约 ${((daysPerWeek / 7) * daysPerMonth).toFixed(1)} 天`
        : `每天都用，每周 ${formatHours(weeklyHours(device))} 小时 · 每月约 ${daysPerMonth} 天`;

  return (
    <div className="device-row">
      <div className="device-icon">{device.name.slice(0, 1) || '·'}</div>
      <label className="field device-name"><span>设备名称</span><input value={device.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
      <label className="field watts-field"><span>功率 <em>W</em></span><input type="number" min="0" step="10" value={device.watts} onChange={numberChange('watts')} /></label>
      <div className="field schedule-field">
        <span>使用规律（按周）</span>
        <div className="schedule-values">
          <label className="schedule-hours">
            <input type="number" min="0" max="24" step="0.5" aria-label="每次使用小时数" value={device.dailyHours} onChange={numberChange('dailyHours')} />
            <em>{hoursSuffix}</em>
          </label>
          <div className="schedule-modes">
            <div role="radiogroup" aria-label="每周使用规律">
              {MODES.map((item) => <button type="button" role="radio" aria-checked={mode === item} key={item} className={mode === item ? 'active' : ''} onClick={() => selectMode(item)}>{scheduleModeLabel(item)}</button>)}
            </div>
            {mode === 'weekly' && (
              <label className="times-picker"><input type="number" min="1" max="7" step="1" aria-label="每周使用次数" value={schedule.timesPerWeek ?? 3} onChange={timesChange} /><em>次 / 周</em></label>
            )}
          </div>
        </div>
        <small className="schedule-hint">{hint}</small>
      </div>
      <button className="icon-button" onClick={onRemove} aria-label={`移除${device.name}`}>×</button>
    </div>
  );
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
