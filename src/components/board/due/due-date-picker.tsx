import { useId, useState } from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '#/components/ui/button';
import { Calendar } from '#/components/ui/calendar';
import { Input } from '#/components/ui/input';
import { addDays, buildDue, dueParts, localDateKey } from '#/lib/due-date';
import type { Due } from '#/lib/due-date';
import { useNow, useTimeZone } from '#/lib/use-time-zone';

// The calendar works with local Dates of the browser; the picker opens only
// after hydration, when the render time zone is the device's one.
function dateKeyToLocal(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function localToDateKey(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isSameDue(a: Due, b: Due) {
    return a.dueDate === b.dueDate && a.dueAt?.getTime() === b.dueAt?.getTime();
}

interface DueDatePickerProps {
    due: Due;
    onChange: (due: Due) => void;
}

/**
 * Today / Tomorrow, a calendar and a 24-hour time field. Picking a day saves
 * it and keeps the time already set; an empty time means the whole day.
 */
export function DueDatePicker({ due, onChange }: DueDatePickerProps) {
    const timeZone = useTimeZone();
    const now = useNow();
    const timeId = useId();
    const errorId = useId();
    const parts = dueParts(due, timeZone);
    const savedTime = parts?.time ?? '';
    const [timeText, setTimeText] = useState(savedTime);
    const [isTimeInvalid, setIsTimeInvalid] = useState(false);
    const todayKey = localDateKey(now, timeZone);

    function change(next: Due | null) {
        if (next && !isSameDue(next, due)) onChange(next);
    }

    function pickDate(dateKey: string) {
        change(buildDue(dateKey, savedTime, timeZone));
    }

    function commitTime() {
        if (!parts) return;
        const next = buildDue(parts.date, timeText, timeZone);
        setIsTimeInvalid(!next);
        if (!next) return;
        setTimeText(dueParts(next, timeZone)?.time ?? '');
        change(next);
    }

    function clearTime() {
        setTimeText('');
        setIsTimeInvalid(false);
        if (parts) change(buildDue(parts.date, '', timeZone));
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pickDate(todayKey)}
                >
                    Today
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pickDate(addDays(todayKey, 1))}
                >
                    Tomorrow
                </Button>
            </div>
            <Calendar
                mode="single"
                required
                selected={parts ? dateKeyToLocal(parts.date) : undefined}
                defaultMonth={dateKeyToLocal(parts?.date ?? todayKey)}
                today={dateKeyToLocal(todayKey)}
                onSelect={(date) => pickDate(localToDateKey(date))}
                weekStartsOn={1}
                className="mx-auto p-0"
            />
            <div className="flex items-center gap-2">
                <label htmlFor={timeId} className="text-sm font-medium">
                    Time
                </label>
                <div className="relative flex-1">
                    <Input
                        id={timeId}
                        value={timeText}
                        placeholder={parts ? 'All day' : 'Pick a day first'}
                        disabled={!parts}
                        inputMode="numeric"
                        maxLength={5}
                        aria-invalid={isTimeInvalid}
                        aria-describedby={isTimeInvalid ? errorId : undefined}
                        className="pr-9"
                        onChange={(e) => setTimeText(e.target.value)}
                        onBlur={commitTime}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                commitTime();
                            }
                        }}
                    />
                    {timeText !== '' && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Clear time"
                            className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                            onClick={clearTime}
                        >
                            <XIcon />
                        </Button>
                    )}
                </div>
            </div>
            {isTimeInvalid && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-xs text-destructive"
                >
                    Enter a 24-hour time, like 15:00.
                </p>
            )}
        </div>
    );
}
