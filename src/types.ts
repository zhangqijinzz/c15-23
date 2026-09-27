export type WeeklyMode = 'daily' | 'weekdays' | 'weekly';

export interface WeeklySchedule {
  /** daily：每天都用；weekdays：只在工作日（每周 5 天）；weekly：每周固定用几次 */
  mode: WeeklyMode;
  /** mode 为 weekly 时，每周使用次数（1–7 的整数） */
  timesPerWeek?: number;
}

export interface EnergyDevice {
  id: string;
  name: string;
  watts: number;
  /** 每个使用日（或每次使用）的小时数 */
  dailyHours: number;
  /** 按周描述的使用规律；旧数据没有该字段时按“每天都用”计算，结果与历史一致 */
  schedule?: WeeklySchedule;
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
  /** 按日历日摊薄的日均用电（周使用天数 ÷ 7 折算） */
  dailyKwh: number;
  monthlyKwh: number;
  monthlyCost: number;
}

export interface DeviceSummary extends EnergyDevice, EnergyEstimate {
  share: number;
  /** 每周实际使用天数（weekly 模式即每周次数） */
  usageDaysPerWeek: number;
  /** 每周使用小时数 */
  weeklyHours: number;
  /** 折算到每个计费月的等效使用天数 */
  avgDaysPerMonth: number;
}

export interface ScenarioSummary {
  total: EnergyEstimate;
  devices: DeviceSummary[];
}
