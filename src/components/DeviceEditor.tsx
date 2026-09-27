import type { ChangeEvent } from 'react';
import type { EnergyDevice, UsagePatternKind } from '../types';

interface DeviceEditorProps {
  device: EnergyDevice;
  onChange: (patch: Partial<EnergyDevice>) => void;
  onRemove: () => void;
}

const PATTERN_OPTIONS: Array<{ kind: UsagePatternKind; label: string }> = [
  { kind: 'daily', label: '每天' },
  { kind: 'weekdays', label: '仅工作日' },
  { kind: 'timesPerWeek', label: '每周几次' },
];

const DEFAULT_TIMES_PER_WEEK = 3;

export function DeviceEditor({ device, onChange, onRemove }: DeviceEditorProps) {
  const numberChange = (key: 'watts' | 'dailyHours') => (event: ChangeEvent<HTMLInputElement>) => onChange({ [key]: Number(event.target.value) });
  const pattern: EnergyDevice['usage'] = device.usage ?? { kind: 'daily' };
  const selectPattern = (kind: UsagePatternKind) => {
    if (kind === 'timesPerWeek') {
      const timesPerWeek = pattern?.kind === 'timesPerWeek' ? pattern.timesPerWeek : DEFAULT_TIMES_PER_WEEK;
      onChange({ usage: { kind, timesPerWeek } });
    } else {
      onChange({ usage: { kind } });
    }
  };
  return (
    <div className="device-row">
      <div className="device-icon">{device.name.slice(0, 1) || '·'}</div>
      <label className="field device-name"><span>设备名称</span><input value={device.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
      <label className="field"><span>功率 <em>W</em></span><input type="number" min="0" step="10" value={device.watts} onChange={numberChange('watts')} /></label>
      <label className="field"><span>每日使用 <em>小时</em></span><input type="number" min="0" max="24" step="0.5" value={device.dailyHours} onChange={numberChange('dailyHours')} /></label>
      <button className="icon-button" onClick={onRemove} aria-label={`移除${device.name}`}>×</button>
      <div className="usage-pattern" role="group" aria-label={`${device.name}的使用规律`}>
        <span className="usage-label">使用规律</span>
        <div className="usage-options">
          {PATTERN_OPTIONS.map((option) => (
            <button key={option.kind} type="button" className={pattern?.kind === option.kind ? 'active' : ''} onClick={() => selectPattern(option.kind)}>{option.label}</button>
          ))}
          {pattern?.kind === 'timesPerWeek' && (
            <label className="usage-times">每周
              <input type="number" min="1" max="7" step="0.5" value={pattern.timesPerWeek ?? ''} aria-label="每周使用次数"
                onChange={(event) => onChange({ usage: { kind: 'timesPerWeek', timesPerWeek: Number(event.target.value) } })} />
              次</label>
          )}
        </div>
      </div>
    </div>
  );
}
