import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DueDatePicker } from '#/components/board/due/due-date-picker';
import type { Due } from '#/lib/due-date';

// The calendar works with the device's local dates: render in the same zone.
// The clock and zone come from the root route context; no router here.
vi.mock('#/lib/use-time-zone', () => ({
    useTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    useNow: () => new Date(2026, 9, 12, 12),
}));

const OCT_15: Due = { dueDate: '2026-10-15', dueAt: null };

// Keeps the saved due date like the card window does.
function Harness({
    initial,
    onChange,
    onClose,
}: {
    initial: Due;
    onChange: (due: Due) => void;
    onClose: () => void;
}) {
    const [due, setDue] = useState(initial);
    return (
        <DueDatePicker
            due={due}
            onChange={(next) => {
                setDue(next);
                onChange(next);
            }}
            onClose={onClose}
        />
    );
}

function renderPicker(initial: Due) {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<Harness initial={initial} onChange={onChange} onClose={onClose} />);
    return { onChange, onClose };
}

function dayButton(day: number) {
    return screen.getByRole('button', {
        name: new RegExp(`October ${day}(st|nd|rd|th), 2026`),
    });
}

describe('DueDatePicker', () => {
    it('has no Today / Tomorrow shortcuts: the calendar and the time only', () => {
        renderPicker(OCT_15);

        expect(
            screen.queryByRole('button', { name: /^(Today|Tomorrow)$/ }),
        ).not.toBeInTheDocument();
        expect(screen.getByLabelText('Time')).toBeInTheDocument();
    });

    it('Enter on the day just clicked closes the picker', async () => {
        const user = userEvent.setup();
        const { onChange, onClose } = renderPicker({
            dueDate: null,
            dueAt: null,
        });

        await user.click(dayButton(15));
        expect(onChange).toHaveBeenCalledWith(OCT_15);
        await user.keyboard('{Enter}');

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('Enter on the already selected day closes without a change', async () => {
        const user = userEvent.setup();
        const { onChange, onClose } = renderPicker(OCT_15);

        await user.click(dayButton(15));
        await user.keyboard('{Enter}');

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('Enter on a day reached with the arrows picks it and closes', async () => {
        const user = userEvent.setup();
        const { onChange, onClose } = renderPicker(OCT_15);

        await user.click(dayButton(15));
        await user.keyboard('{ArrowRight}{Enter}');

        expect(onChange).toHaveBeenCalledWith({
            dueDate: '2026-10-16',
            dueAt: null,
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Enter in the time field saves a valid time and closes', async () => {
        const user = userEvent.setup();
        const { onChange, onClose } = renderPicker(OCT_15);

        await user.type(screen.getByLabelText('Time'), '15:00{Enter}');

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0]).toEqual({
            dueDate: null,
            dueAt: new Date(2026, 9, 15, 15),
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Enter in the time field keeps the picker open on an invalid time', async () => {
        const user = userEvent.setup();
        const { onChange, onClose } = renderPicker(OCT_15);

        await user.type(screen.getByLabelText('Time'), '25:00{Enter}');

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });
});
