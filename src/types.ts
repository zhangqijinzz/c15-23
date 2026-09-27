export type UsagePatternKind = 'daily' | 'weekdays' | 'timesPerWeek';

export interface UsagePattern {
  kind: UsagePatternKind;
  /** 仅 kind 为 timesPerWeek 时必填，每周使用次数（1–7）。 */
  timesPerWeek?: number;
}

export interface EnergyDevice {
  id: string;
  name: string;
  watts: number;
  dailyHours: number;
  /** 每周使用规律；缺省视为每天使用（兼容旧数据）。 */
  usage?: UsagePattern;
}

export interface EnergyScenario {
  id: string;
  name: string;
  pricePerKwh: number;
  daysPerMonth: number;
  devices: EnergyDevice[];
  createdAt: string;
}

export interface EnergyDocument {
  version: 1;
  scenarios: EnergyScenario[];
  activeScenarioId: string;
}

export type ViewStatus = 'loading' | 'ready' | 'editing' | 'error' | 'completed';

export interface Notice {
  kind: 'success' | 'error' | 'info';
  text: string;
}

export interface EnergyEstimate {
  dailyKwh: number;
  monthlyKwh: number;
  monthlyCost: number;
}

export interface ScenarioSummary {
  total: EnergyEstimate;
  devices: Array<EnergyDevice & EnergyEstimate & { share: number }>;
}
