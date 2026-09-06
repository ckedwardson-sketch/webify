import { getDb } from "./database";

export interface SleepLog {
  studyDate: string;
  bedtime: string | null;
  wakeTime: string | null;
  sleepLatencyMinutes: number | null;
  awakeningsCount: number | null;
  awakeningsMinutes: number | null;
  sleepQuality: number | null;
  sleepiness: number | null;
  energy: number | null;
  mood: number | null;
}

export interface TestResult {
  studyDate: string;
  testKey: string;
  score: Record<string, unknown>;
  createdAt: string;
}

export async function fetchStartDate(): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ startDate: string | null }[]>(
    `SELECT start_date as startDate FROM sleep_study_settings WHERE id = 1`
  );
  return rows.length ? rows[0].startDate : null;
}

export async function setStartDate(date: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO sleep_study_settings (id, start_date) VALUES (1, $1)
     ON CONFLICT(id) DO UPDATE SET start_date = excluded.start_date`,
    [date]
  );
}

const LOG_SELECT = `SELECT study_date as studyDate, bedtime, wake_time as wakeTime,
  sleep_latency_minutes as sleepLatencyMinutes, awakenings_count as awakeningsCount,
  awakenings_minutes as awakeningsMinutes, sleep_quality as sleepQuality, sleepiness,
  energy, mood FROM sleep_study_logs`;

export async function fetchLog(studyDate: string): Promise<SleepLog | null> {
  const db = await getDb();
  const rows = await db.select<SleepLog[]>(`${LOG_SELECT} WHERE study_date = $1`, [studyDate]);
  return rows.length ? rows[0] : null;
}

export async function fetchAllLogs(): Promise<SleepLog[]> {
  const db = await getDb();
  return db.select<SleepLog[]>(`${LOG_SELECT} ORDER BY study_date ASC`);
}

export async function upsertLog(log: SleepLog): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO sleep_study_logs
       (study_date, bedtime, wake_time, sleep_latency_minutes, awakenings_count, awakenings_minutes, sleep_quality, sleepiness, energy, mood, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
     ON CONFLICT(study_date) DO UPDATE SET
       bedtime = excluded.bedtime,
       wake_time = excluded.wake_time,
       sleep_latency_minutes = excluded.sleep_latency_minutes,
       awakenings_count = excluded.awakenings_count,
       awakenings_minutes = excluded.awakenings_minutes,
       sleep_quality = excluded.sleep_quality,
       sleepiness = excluded.sleepiness,
       energy = excluded.energy,
       mood = excluded.mood,
       updated_at = CURRENT_TIMESTAMP`,
    [
      log.studyDate,
      log.bedtime,
      log.wakeTime,
      log.sleepLatencyMinutes,
      log.awakeningsCount,
      log.awakeningsMinutes,
      log.sleepQuality,
      log.sleepiness,
      log.energy,
      log.mood,
    ]
  );
}

export async function fetchTestResults(studyDate: string): Promise<TestResult[]> {
  const db = await getDb();
  const rows = await db.select<{ studyDate: string; testKey: string; scoreJson: string; createdAt: string }[]>(
    `SELECT study_date as studyDate, test_key as testKey, score_json as scoreJson, created_at as createdAt
     FROM sleep_study_test_results WHERE study_date = $1`,
    [studyDate]
  );
  return rows.map((r) => ({ studyDate: r.studyDate, testKey: r.testKey, score: JSON.parse(r.scoreJson), createdAt: r.createdAt }));
}

export async function fetchAllTestResults(): Promise<TestResult[]> {
  const db = await getDb();
  const rows = await db.select<{ studyDate: string; testKey: string; scoreJson: string; createdAt: string }[]>(
    `SELECT study_date as studyDate, test_key as testKey, score_json as scoreJson, created_at as createdAt
     FROM sleep_study_test_results ORDER BY study_date ASC`
  );
  return rows.map((r) => ({ studyDate: r.studyDate, testKey: r.testKey, score: JSON.parse(r.scoreJson), createdAt: r.createdAt }));
}

export async function saveTestResult(studyDate: string, testKey: string, score: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO sleep_study_test_results (study_date, test_key, score_json) VALUES ($1, $2, $3)
     ON CONFLICT(study_date, test_key) DO UPDATE SET score_json = excluded.score_json, created_at = CURRENT_TIMESTAMP`,
    [studyDate, testKey, JSON.stringify(score)]
  );
}
