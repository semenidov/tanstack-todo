import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { LoaderCircleIcon } from 'lucide-react';
import { LabelChip } from '#/components/board/labels/label-strip';
import type { LabelFormValues } from '#/components/board/labels/label-mutations';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Label as FieldLabel } from '#/components/ui/label';
import {
    DEFAULT_LABEL_COLOR,
    LABEL_COLORS,
    LABEL_COLOR_STYLES,
} from '#/lib/label-colors';
import type { LabelColor } from '#/lib/label-colors';
import {
    LABEL_EXISTS_MESSAGE,
    MAX_LABEL_TITLE_LENGTH,
    isDuplicateLabelTitle,
    normalizeLabelTitle,
} from '#/lib/labels';
import type { Label } from '#/lib/labels';

interface LabelFormProps {
    /** Labels of the board, for the duplicate title check. */
    labels: ReadonlyArray<Label>;
    /** The label being edited; none - a new label. */
    label?: Label;
    submitText: string;
    isPending: boolean;
    onSubmit: (values: LabelFormValues) => void;
    /** Next to the submit button: Delete in the Edit screen. */
    extraAction?: ReactNode;
}

// Create / Edit label screen: preview, title (optional), color.
export function LabelForm({
    labels,
    label,
    submitText,
    isPending,
    onSubmit,
    extraAction,
}: LabelFormProps) {
    const id = useId();
    const [title, setTitle] = useState(label?.title ?? '');
    const [color, setColor] = useState<LabelColor>(
        LABEL_COLORS.find((c) => c === label?.color) ?? DEFAULT_LABEL_COLOR,
    );
    const normalized = normalizeLabelTitle(title);
    const isDuplicate = isDuplicateLabelTitle(labels, normalized, label?.id);

    return (
        <form
            className="grid min-w-0 gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                if (isDuplicate || isPending) return;
                onSubmit({ title, color });
            }}
        >
            <div className="flex justify-center rounded-md bg-muted p-3">
                <LabelChip
                    label={{ title: normalized, color }}
                    className="h-8 text-sm leading-8"
                />
            </div>
            <div className="grid gap-1.5">
                <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
                <Input
                    id={`${id}-title`}
                    autoFocus
                    value={title}
                    maxLength={MAX_LABEL_TITLE_LENGTH}
                    aria-invalid={isDuplicate || undefined}
                    aria-describedby={
                        isDuplicate ? `${id}-title-error` : undefined
                    }
                    onChange={(e) => setTitle(e.target.value)}
                />
                {isDuplicate && (
                    <p
                        id={`${id}-title-error`}
                        role="alert"
                        className="text-sm text-destructive"
                    >
                        {LABEL_EXISTS_MESSAGE}
                    </p>
                )}
            </div>
            <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Color</legend>
                <div className="grid grid-cols-5 gap-1.5">
                    {LABEL_COLORS.map((c) => (
                        <label key={c} className="relative block">
                            <input
                                type="radio"
                                name={`${id}-color`}
                                value={c}
                                checked={color === c}
                                aria-label={LABEL_COLOR_STYLES[c].name}
                                onChange={() => setColor(c)}
                                // Transparent over the swatch: the swatch is what gets clicked.
                                className="peer absolute inset-0 m-0 size-full opacity-0"
                            />
                            <span
                                className={cn(
                                    'block h-8 rounded-md ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
                                    LABEL_COLOR_STYLES[c].className,
                                )}
                            />
                        </label>
                    ))}
                </div>
            </fieldset>
            <div className="flex gap-2">
                <Button
                    type="submit"
                    className="flex-1"
                    disabled={isDuplicate || isPending}
                >
                    {isPending && <LoaderCircleIcon className="animate-spin" />}
                    {submitText}
                </Button>
                {extraAction}
            </div>
        </form>
    );
}
