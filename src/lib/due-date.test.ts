import { describe, expect, it } from 'vitest';
import { DueStatus, buildDue, describeDue, formatCardDate } from './due-date';

const MSK = 'Europe/Moscow'; // UTC+3 all year
const NY = 'America/New_York';

describe('describeDue', () => {
    // The due date is built from what the picker gives (day + time field text)
    // in `tz`, then described at `now` in the same time zone.
    it.each([
        {
            name: 'whole day today: due today until the day ends',
            date: '2026-10-09',
            time: '',
            now: '2026-10-09T23:59:59+03:00',
            expected: {
                status: DueStatus.Soon,
                label: 'Due today',
                text: 'Today',
            },
        },
        {
            name: 'whole day yesterday: overdue from the next day',
            date: '2026-10-09',
            time: '',
            now: '2026-10-10T00:00:00+03:00',
            expected: {
                status: DueStatus.Overdue,
                label: 'Overdue',
                text: 'Yesterday',
            },
        },
        {
            name: 'whole day tomorrow',
            date: '2026-10-10',
            time: '',
            now: '2026-10-09T12:00:00+03:00',
            expected: {
                status: DueStatus.Soon,
                label: 'Due tomorrow',
                text: 'Tomorrow',
            },
        },
        {
            name: 'later this year: a date, neutral',
            date: '2026-10-11',
            time: '',
            now: '2026-10-09T12:00:00+03:00',
            expected: {
                status: DueStatus.Neutral,
                label: 'Due',
                text: 'Oct 11',
            },
        },
        {
            name: 'a moment today, before it',
            date: '2026-10-09',
            time: '15:00',
            now: '2026-10-09T14:59:59+03:00',
            expected: {
                status: DueStatus.Soon,
                label: 'Due today',
                text: 'Today 15:00',
            },
        },
        {
            name: 'a moment today, once it comes',
            date: '2026-10-09',
            time: '15:00',
            now: '2026-10-09T15:00:00+03:00',
            expected: {
                status: DueStatus.Overdue,
                label: 'Overdue',
                text: 'Today 15:00',
            },
        },
        {
            name: 'a moment on a date, one-digit hour',
            date: '2026-10-15',
            time: '9:05',
            now: '2026-10-09T12:00:00+03:00',
            expected: {
                status: DueStatus.Neutral,
                label: 'Due',
                text: 'Oct 15, 09:05',
            },
        },
        {
            name: 'completed card: neutral even when overdue',
            date: '2026-10-01',
            time: '',
            now: '2026-10-09T12:00:00+03:00',
            completed: true,
            expected: {
                status: DueStatus.Neutral,
                label: 'Due',
                text: 'Oct 1',
            },
        },
        {
            name: 'another year: a date with the year',
            date: '2027-01-15',
            time: '',
            now: '2026-10-09T12:00:00+03:00',
            expected: {
                status: DueStatus.Neutral,
                label: 'Due',
                text: 'Jan 15, 2027',
            },
        },
        {
            name: 'another year with a time',
            date: '2025-12-31',
            time: '23:30',
            now: '2026-01-02T12:00:00+03:00',
            expected: {
                status: DueStatus.Overdue,
                label: 'Overdue',
                text: 'Dec 31, 2025, 23:30',
            },
        },
        {
            name: 'time zone: it is already Oct 10 in Moscow',
            date: '2026-10-09',
            time: '',
            now: '2026-10-09T22:30:00Z',
            expected: {
                status: DueStatus.Overdue,
                label: 'Overdue',
                text: 'Yesterday',
            },
        },
        {
            name: 'time zone: the same moment is still Oct 9 in New York',
            date: '2026-10-09',
            time: '',
            now: '2026-10-09T22:30:00Z',
            tz: NY,
            expected: {
                status: DueStatus.Soon,
                label: 'Due today',
                text: 'Today',
            },
        },
        {
            name: 'time zone: a time is local to the zone (EDT, UTC-4)',
            date: '2026-10-09',
            time: '18:00',
            now: '2026-10-09T21:59:00Z',
            tz: NY,
            expected: {
                status: DueStatus.Soon,
                label: 'Due today',
                text: 'Today 18:00',
            },
        },
        {
            name: 'an invalid time is not a due date',
            date: '2026-10-09',
            time: '25:00',
            now: '2026-10-09T12:00:00+03:00',
            expected: null,
        },
    ])(
        '$name',
        ({ date, time, now, tz = MSK, completed = false, expected }) => {
            const due = buildDue(date, time, tz);
            const result =
                due &&
                describeDue(due, {
                    now: new Date(now),
                    timeZone: tz,
                    completed,
                });
            expect(result).toEqual(expected);
        },
    );
});

describe('formatCardDate', () => {
    it.each([
        ['2026-10-09T00:30:00+03:00', 'today'],
        ['2026-10-08T23:30:00+03:00', 'yesterday'],
        ['2026-10-03T12:00:00+03:00', 'Oct 3'],
        ['2025-10-03T12:00:00+03:00', 'Oct 3, 2025'],
    ])('%s → %s', (date, expected) => {
        expect(
            formatCardDate(
                new Date(date),
                new Date('2026-10-09T12:00:00+03:00'),
                MSK,
            ),
        ).toBe(expected);
    });
});
