import { getDb } from "./database";

export interface RaftDogWeek {
  id: number;
  weekStart: string;
  taskText: string | null;
  completed: boolean;
  photoData: string | null;
  isRandom: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface RaftDogBankEntry {
  id: number;
  text: string;
  createdAt: string;
}

type RawWeekRow = {
  id: number;
  weekStart: string;
  taskText: string | null;
  completed: number;
  photoData: string | null;
  isRandom: number;
  createdAt: string;
  completedAt: string | null;
};

const WEEK_SELECT = `SELECT id, week_start as weekStart, task_text as taskText, completed,
       photo_data as photoData, is_random as isRandom, created_at as createdAt, completed_at as completedAt
     FROM raft_dog_weeks`;

function toWeek(r: RawWeekRow): RaftDogWeek {
  return {
    id: r.id,
    weekStart: r.weekStart,
    taskText: r.taskText,
    completed: !!r.completed,
    photoData: r.photoData,
    isRandom: !!r.isRandom,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
  };
}

export async function fetchWeek(weekStart: string): Promise<RaftDogWeek | null> {
  const db = await getDb();
  const rows = await db.select<RawWeekRow[]>(`${WEEK_SELECT} WHERE week_start = $1`, [weekStart]);
  return rows.length ? toWeek(rows[0]) : null;
}

export async function fetchHistory(excludeWeekStart: string): Promise<RaftDogWeek[]> {
  const db = await getDb();
  const rows = await db.select<RawWeekRow[]>(
    `${WEEK_SELECT} WHERE week_start != $1 ORDER BY week_start DESC`,
    [excludeWeekStart]
  );
  return rows.map(toWeek);
}

export async function fetchAllWeeks(): Promise<RaftDogWeek[]> {
  const db = await getDb();
  const rows = await db.select<RawWeekRow[]>(`${WEEK_SELECT} ORDER BY week_start ASC`);
  return rows.map(toWeek);
}

export async function fetchBank(): Promise<RaftDogBankEntry[]> {
  const db = await getDb();
  return db.select<RaftDogBankEntry[]>(
    `SELECT id, text, created_at as createdAt FROM raft_dog_bank ORDER BY created_at ASC`
  );
}

export async function addToBank(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const db = await getDb();
  await db.execute(`INSERT INTO raft_dog_bank (text) VALUES ($1)`, [trimmed]);
}

async function removeFromBank(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM raft_dog_bank WHERE id = $1`, [id]);
}

// Sets the current week's task text — booting out and banking whatever
// (unfinished) text was already sitting there, per the app's "type over
// it and the old one goes to the saved list" rule.
export async function setWeekTask(weekStart: string, text: string, isRandom = false): Promise<void> {
  const db = await getDb();
  const existing = await fetchWeek(weekStart);
  if (existing && existing.taskText && !existing.completed) {
    await addToBank(existing.taskText);
  }
  if (existing) {
    await db.execute(
      `UPDATE raft_dog_weeks SET task_text = $1, is_random = $2, completed = 0, photo_data = NULL, completed_at = NULL
       WHERE week_start = $3`,
      [text.trim(), isRandom ? 1 : 0, weekStart]
    );
  } else {
    await db.execute(
      `INSERT INTO raft_dog_weeks (week_start, task_text, is_random) VALUES ($1, $2, $3)`,
      [weekStart, text.trim(), isRandom ? 1 : 0]
    );
  }
}

export async function completeWeekTask(weekStart: string, photoData: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE raft_dog_weeks SET completed = 1, photo_data = $1, completed_at = CURRENT_TIMESTAMP WHERE week_start = $2`,
    [photoData, weekStart]
  );
}

// Weekend auto-fill: pulls one random entry out of the bank and sets it
// as this week's (random) task. Returns null if the bank is empty.
export async function drawRandomTaskFromBank(weekStart: string): Promise<string | null> {
  const bank = await fetchBank();
  if (bank.length === 0) return null;
  const pick = bank[Math.floor(Math.random() * bank.length)];
  await removeFromBank(pick.id);
  await setWeekTask(weekStart, pick.text, true);
  return pick.text;
}

// Refresh button — re-randomizes while the current task is still an
// un-taken random pull. Books the currently-shown text back into the
// bank first (excluded from the redraw so it isn't just handed straight
// back on a bank of size 1's only alternative... unless it's the only one).
export async function reshuffleRandomTask(weekStart: string): Promise<string | null> {
  const current = await fetchWeek(weekStart);
  if (current?.taskText) {
    await addToBank(current.taskText);
  }
  const bank = await fetchBank();
  if (bank.length === 0) return null;
  const currentText = current?.taskText;
  const alternatives = bank.filter((b) => b.text !== currentText);
  const pool = alternatives.length > 0 ? alternatives : bank;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  await removeFromBank(pick.id);
  await setWeekTask(weekStart, pick.text, true);
  return pick.text;
}
