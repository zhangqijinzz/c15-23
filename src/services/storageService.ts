import { validateSchedule } from '../domain';
import type { EnergyDocument, WeeklySchedule } from '../types';

const STORAGE_KEY = 'energy-lens.document.v1';

export function readDocument(): EnergyDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isDocument(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDocument(document: EnergyDocument): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
}

function isDocument(value: unknown): value is EnergyDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EnergyDocument>;
  return candidate.version === 1
    && typeof candidate.activeScenarioId === 'string'
    && Array.isArray(candidate.scenarios)
    && candidate.scenarios.length > 0
    && candidate.scenarios.every(isScenario)
    && candidate.scenarios.some((scenario) => scenario.id === candidate.activeScenarioId);
}

function isScenario(value: unknown): value is EnergyDocument['scenarios'][number] {
  if (!value || typeof value !== 'object') return false;
  const scenario = value as Partial<EnergyDocument['scenarios'][number]>;
  return typeof scenario.id === 'string'
    && typeof scenario.name === 'string'
    && typeof scenario.createdAt === 'string'
    && typeof scenario.pricePerKwh === 'number'
    && scenario.pricePerKwh >= 0
    && typeof scenario.daysPerMonth === 'number'
    && scenario.daysPerMonth >= 1
    && scenario.daysPerMonth <= 31
    && Array.isArray(scenario.devices)
    && scenario.devices.length > 0
    && scenario.devices.every(isDevice);
}

function isDevice(value: unknown): value is EnergyDocument['scenarios'][number]['devices'][number] {
  if (!value || typeof value !== 'object') return false;
  const device = value as Partial<EnergyDocument['scenarios'][number]['devices'][number]>;
  if (typeof device.id !== 'string'
    || typeof device.name !== 'string'
    || typeof device.watts !== 'number'
    || device.watts < 0
    || typeof device.dailyHours !== 'number'
    || device.dailyHours < 0
    || device.dailyHours > 24) return false;
  // 旧数据没有 schedule 字段，按“每天都用”处理；存在时必须自洽
  return device.schedule === undefined || isValidSchedule(device.schedule, device.dailyHours);
}

function isValidSchedule(schedule: WeeklySchedule, dailyHours: number): boolean {
  if (!schedule || typeof schedule !== 'object') return false;
  if (schedule.mode !== 'daily' && schedule.mode !== 'weekdays' && schedule.mode !== 'weekly') return false;
  if (schedule.timesPerWeek !== undefined && (typeof schedule.timesPerWeek !== 'number' || schedule.timesPerWeek < 1 || schedule.timesPerWeek > 7)) return false;
  return validateSchedule(dailyHours, schedule) === null;
}
