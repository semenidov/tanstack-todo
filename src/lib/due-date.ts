// Card due dates (#120): status and text relative to `now` in a time zone, and
// building a due date from the picker's day and time. A due date is either a
// whole day (`dueDate`, a calendar date without a zone) or an exact moment
// (`dueAt`), never both. Dates here are `YYYY-MM-DD` keys: they compare as
// strings.

export interface Due {
    dueDate: string | null;
    dueAt: Date | null;
}

export enum DueStatus {
    /** Whole day: after the day ends; with a time: from that moment. */
    Overdue = 'overdue',
    /** Today or tomorrow and not overdue. */
    Soon = 'soon',
    Neutral = 'neutral',
}

export interface DueDescription {
    status: DueStatus;
    /** The status in words, for screen readers: the color is not enough. */
    label: string;
    /** `Today 15:00`, `Oct 15`, `Oct 15, 2027, 15:00`. */
    text: string;
}

export const UTC = 'UTC';

/** The device's IANA time zone. */
export function deviceTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function isTimeZone(value: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

// Intl formatters are costly to create; a board renders many badges.
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(instant: Date, timeZone: string) {
    let format = partsFormatters.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        });
        partsFormatters.set(timeZone, format);
    }
    const parts: Record<string, string> = {};
    for (const part of format.formatToParts(instant)) {
        parts[part.type] = part.value;
    }
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
    };
}

const pad = (n: number) => String(n).padStart(2, '0');

function toDateKey(year: number, month: number, day: number) {
    return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

function parseDateKey(key: string) {
    const [year, month, day] = key.split('-').map(Number);
    return { year, month, day };
}

/** The calendar date of `instant` in `timeZone`, as `YYYY-MM-DD`. */
export function localDateKey(instant: Date, timeZone: string): string {
    const p = zonedParts(instant, timeZone);
    return toDateKey(p.year, p.month, p.day);
}

export function addDays(dateKey: string, days: number): string {
    const { year, month, day } = parseDateKey(dateKey);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return toDateKey(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
    );
}

/** `HH:mm` of `instant` in `timeZone`, 24-hour. */
function localTime(instant: Date, timeZone: string) {
    const p = zonedParts(instant, timeZone);
    return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Offset of `timeZone` from UTC at `instant`, in ms. */
function zoneOffset(instant: number, timeZone: string) {
    const p = zonedParts(new Date(instant), timeZone);
    const asUtc = Date.UTC(
        p.year,
        p.month - 1,
        p.day,
        p.hour,
        p.minute,
        p.second,
    );
    return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The moment when the wall clock in `timeZone` shows this date and time. */
function zonedMoment(dateKey: string, time: string, timeZone: string) {
    const { year, month, day } = parseDateKey(dateKey);
    const [hour, minute] = time.split(':').map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    // The offset at the guess may differ from the one at the result around a
    // DST switch: correct once with the offset at the first result.
    const first = wall - zoneOffset(wall, timeZone);
    return new Date(wall - zoneOffset(first, timeZone));
}

/** `9:05` / `09:05` / `0905` → `09:05`; null if not a 24-hour time. */
export function parseTime(raw: string): string | null {
    const match = /^(\d{1,2}):?(\d{2})$/.exec(raw.trim());
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return `${pad(hour)}:${pad(minute)}`;
}

/**
 * The due date for a day picked in the calendar and the time field's text,
 * both in `timeZone`. An empty time means the whole day; null if the time is
 * not valid.
 */
export function buildDue(
    dateKey: string,
    rawTime: string,
    timeZone: string,
): Due | null {
    if (rawTime.trim() === '') return { dueDate: dateKey, dueAt: null };
    const time = parseTime(rawTime);
    if (!time) return null;
    return { dueDate: null, dueAt: zonedMoment(dateKey, time, timeZone) };
}

/** The day and time (`HH:mm`, or null for a whole day) of a due date in `timeZone`. */
export function dueParts(
    due: Due,
    timeZone: string,
): { date: string; time: string | null } | null {
    if (due.dueAt) {
        return {
            date: localDateKey(due.dueAt, timeZone),
            time: localTime(due.dueAt, timeZone),
        };
    }
    if (due.dueDate) return { date: due.dueDate, time: null };
    return null;
}

const dayFormatters = {
    sameYear: new Intl.DateTimeFormat('en-US', {
        timeZone: UTC,
        month: 'short',
        day: 'numeric',
    }),
    otherYear: new Intl.DateTimeFormat('en-US', {
        timeZone: UTC,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }),
};

/** `Oct 15`, or `Oct 15, 2027` when the year is not the year of `todayKey`. */
function formatDateKey(dateKey: string, todayKey: string) {
    const { year, month, day } = parseDateKey(dateKey);
    const sameYear = year === parseDateKey(todayKey).year;
    const format = sameYear ? dayFormatters.sameYear : dayFormatters.otherYear;
    return format.format(new Date(Date.UTC(year, month - 1, day)));
}

function relativeDay(dateKey: string, todayKey: string) {
    if (dateKey === todayKey) return 'Today';
    if (dateKey === addDays(todayKey, 1)) return 'Tomorrow';
    if (dateKey === addDays(todayKey, -1)) return 'Yesterday';
    return null;
}

/**
 * Status and text of a due date at `now` in `timeZone`; null without a due
 * date. A completed card's due date is always neutral.
 */
export function describeDue(
    due: Due,
    {
        now,
        timeZone,
        completed,
    }: { now: Date; timeZone: string; completed: boolean },
): DueDescription | null {
    const parts = dueParts(due, timeZone);
    if (!parts) return null;
    const todayKey = localDateKey(now, timeZone);

    const relative = relativeDay(parts.date, todayKey);
    let text = relative ?? formatDateKey(parts.date, todayKey);
    if (parts.time) text += relative ? ` ${parts.time}` : `, ${parts.time}`;

    const overdue = due.dueAt
        ? now.getTime() >= due.dueAt.getTime()
        : parts.date < todayKey;
    if (completed) return { status: DueStatus.Neutral, label: 'Due', text };
    if (overdue) return { status: DueStatus.Overdue, label: 'Overdue', text };
    if (relative === 'Today') {
        return { status: DueStatus.Soon, label: 'Due today', text };
    }
    if (relative === 'Tomorrow') {
        return { status: DueStatus.Soon, label: 'Due tomorrow', text };
    }
    return { status: DueStatus.Neutral, label: 'Due', text };
}

/** `today`, `yesterday`, `Oct 3`, `Oct 3, 2025`: for "Created · Updated". */
export function formatCardDate(
    instant: Date,
    now: Date,
    timeZone: string,
): string {
    const dateKey = localDateKey(instant, timeZone);
    const todayKey = localDateKey(now, timeZone);
    const relative = relativeDay(dateKey, todayKey);
    return relative ? relative.toLowerCase() : formatDateKey(dateKey, todayKey);
}
