import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from '#/components/theme-toggle';

function renderToggle() {
    return render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <ThemeToggle />
        </ThemeProvider>,
    );
}

describe('ThemeToggle', () => {
    it('cycles from light to dark on click', async () => {
        const user = userEvent.setup();
        renderToggle();

        expect(
            await screen.findByLabelText('Theme: Light'),
        ).toBeInTheDocument();

        await user.click(screen.getByLabelText('Theme: Light'));

        expect(await screen.findByLabelText('Theme: Dark')).toBeInTheDocument();
    });
});
