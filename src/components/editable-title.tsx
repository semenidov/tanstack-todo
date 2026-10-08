import type { ReactNode, Ref } from 'react';
import { Input } from '#/components/ui/input';
import { cn } from 'cn';

interface EditableTitleProps {
    title: string;
    isEditing: boolean;
    disabled?: boolean;
    /** Classes of the button shown when not editing. */
    className?: string;
    /** Classes of the input shown while editing. */
    inputClassName?: string;
    /** Accessible name of the input. */
    'aria-label': string;
    /** Extra button content next to the title, e.g. a counter. */
    children?: ReactNode;
    /**
     * The button is a drag handle (a list column): Space picks it up, so the
     * native Space click must not start editing. Enter and click still do.
     */
    spaceStartsDrag?: boolean;
    buttonRef?: Ref<HTMLButtonElement>;
    /** The drag instructions of a drag handle. */
    'aria-describedby'?: string;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onSave: (title: string) => void;
}

/** Title that turns into an uncontrolled input on click; `isEditing` is owned by the parent. */
export function EditableTitle({
    title,
    isEditing,
    disabled = false,
    className,
    inputClassName,
    'aria-label': ariaLabel,
    children,
    spaceStartsDrag = false,
    buttonRef,
    'aria-describedby': ariaDescribedBy,
    onStartEditing,
    onCancelEditing,
    onSave,
}: EditableTitleProps) {
    function commit(raw: string) {
        const trimmed = raw.trim();
        if (trimmed && trimmed !== title) {
            onSave(trimmed);
        }
        onCancelEditing();
    }

    if (isEditing) {
        // Mounted anew on every edit, so defaultValue always starts from the current title.
        return (
            <Input
                autoFocus
                defaultValue={title}
                aria-label={ariaLabel}
                className={inputClassName}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => commit(e.currentTarget.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit(e.currentTarget.value);
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancelEditing();
                    }
                }}
            />
        );
    }

    return (
        <button
            ref={buttonRef}
            type="button"
            onClick={onStartEditing}
            // A button clicks on Space keyup; cancelling the keyup cancels the click.
            onKeyUp={(e) => {
                if (spaceStartsDrag && e.key === ' ') e.preventDefault();
            }}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
            className={cn('min-w-0 text-left', className)}
        >
            <span title={title} className="truncate">
                {title}
            </span>
            {children}
        </button>
    );
}
