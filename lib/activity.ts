import { randomUUID } from "crypto";
import type { Activity, Database } from "./types";

export function appendActivity(
  db: Database,
  partial: Omit<Activity, "id" | "timestamp">,
): Activity {
  const activity: Activity = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...partial,
  };
  db.activities.push(activity);
  return activity;
}
