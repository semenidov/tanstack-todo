import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '#/components/theme-toggle';

beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
});

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
