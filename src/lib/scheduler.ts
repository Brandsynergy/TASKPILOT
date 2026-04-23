export type ScheduleConfig = {
  scheduleType: string; // "manual"|"hourly"|"daily"|"weekly"|"monthly"
  scheduleHour: number;
  scheduleMinute: number;
  scheduleDow?: number | null; // 0=Sun…6=Sat
  scheduleDom?: number | null; // 1-31
};

/**
 * Given a schedule config, return the next Date the automation should run.
 * Returns null for "manual" schedules.
 */
export function calculateNextRun(cfg: ScheduleConfig): Date | null {
  if (cfg.scheduleType === "manual") return null;

  const now = new Date();
  const next = new Date(now);

  switch (cfg.scheduleType) {
    case "hourly": {
      next.setMinutes(cfg.scheduleMinute, 0, 0);
      if (next <= now) next.setHours(next.getHours() + 1);
      break;
    }
    case "daily": {
      next.setHours(cfg.scheduleHour, cfg.scheduleMinute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      break;
    }
    case "weekly": {
      const targetDow = cfg.scheduleDow ?? 1; // Monday default
      next.setHours(cfg.scheduleHour, cfg.scheduleMinute, 0, 0);
      const currentDow = next.getDay();
      let daysUntil = (targetDow - currentDow + 7) % 7;
      if (daysUntil === 0 && next <= now) daysUntil = 7;
      next.setDate(next.getDate() + daysUntil);
      break;
    }
    case "monthly": {
      const targetDom = cfg.scheduleDom ?? 1;
      next.setDate(targetDom);
      next.setHours(cfg.scheduleHour, cfg.scheduleMinute, 0, 0);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDom);
      }
      break;
    }
    default:
      return null;
  }

  return next;
}

export const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export function describeSchedule(cfg: ScheduleConfig): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(cfg.scheduleHour)}:${pad(cfg.scheduleMinute)}`;
  switch (cfg.scheduleType) {
    case "manual":   return "Manual only";
    case "hourly":   return `Every hour at :${pad(cfg.scheduleMinute)}`;
    case "daily":    return `Every day at ${time}`;
    case "weekly":   return `Every ${DAYS_OF_WEEK[cfg.scheduleDow ?? 1]} at ${time}`;
    case "monthly":  return `Monthly on day ${cfg.scheduleDom ?? 1} at ${time}`;
    default:         return cfg.scheduleType;
  }
}
