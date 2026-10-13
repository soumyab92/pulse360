import { TestResult } from '../types';

const STORAGE_KEY = 'pulse360_test_history_v1';
const MAX_HISTORY = 100;

export function getTestHistory(): TestResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse history:', e);
    return [];
  }
}

export function getLastRun(): TestResult | null {
  const history = getTestHistory();
  return history.length > 0 ? history[0] : null;
}

export function saveTestRun(result: TestResult): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getTestHistory();
    const updated = [result, ...history.filter(h => h.id !== result.id)].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save test run:', e);
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export interface HourlyHeatmapSlot {
  hour: number; // 0 to 23
  label: string; // '12 AM', '1 AM'...
  avgDownload: number;
  avgUpload: number;
  avgLatency: number;
  testCount: number;
  congestionLevel: 'normal' | 'moderate' | 'heavy' | 'nodata';
}

export function computeTimeHeatmap(): HourlyHeatmapSlot[] {
  const history = getTestHistory();
  const slots: HourlyHeatmapSlot[] = Array.from({ length: 24 }, (_, hour) => {
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return {
      hour,
      label: `${hour12} ${ampm}`,
      avgDownload: 0,
      avgUpload: 0,
      avgLatency: 0,
      testCount: 0,
      congestionLevel: 'nodata'
    };
  });

  const hourBuckets: Record<number, { down: number[]; up: number[]; lat: number[] }> = {};
  for (let h = 0; h < 24; h++) {
    hourBuckets[h] = { down: [], up: [], lat: [] };
  }

  for (const item of history) {
    const date = new Date(item.timestamp);
    const hour = date.getHours();
    hourBuckets[hour].down.push(item.download);
    hourBuckets[hour].up.push(item.upload);
    hourBuckets[hour].lat.push(item.latency);
  }

  let globalAvgDown = 0;
  let totalTests = 0;

  for (let h = 0; h < 24; h++) {
    const b = hourBuckets[h];
    if (b.down.length > 0) {
      const avgD = b.down.reduce((a, b) => a + b, 0) / b.down.length;
      const avgU = b.up.reduce((a, b) => a + b, 0) / b.up.length;
      const avgL = b.lat.reduce((a, b) => a + b, 0) / b.lat.length;

      slots[h].avgDownload = Math.round(avgD * 10) / 10;
      slots[h].avgUpload = Math.round(avgU * 10) / 10;
      slots[h].avgLatency = Math.round(avgL);
      slots[h].testCount = b.down.length;

      globalAvgDown += avgD * b.down.length;
      totalTests += b.down.length;
    }
  }

  if (totalTests > 0) {
    globalAvgDown /= totalTests;
    for (const slot of slots) {
      if (slot.testCount === 0) {
        slot.congestionLevel = 'nodata';
      } else if (slot.avgDownload < globalAvgDown * 0.75) {
        slot.congestionLevel = 'heavy'; // Significant slowdown during this hour
      } else if (slot.avgDownload < globalAvgDown * 0.90) {
        slot.congestionLevel = 'moderate';
      } else {
        slot.congestionLevel = 'normal';
      }
    }
  }

  return slots;
}

