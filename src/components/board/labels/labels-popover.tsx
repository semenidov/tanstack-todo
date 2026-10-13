import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    CheckIcon,
    LoaderCircleIcon,
    PencilIcon,
    PlusIcon,
} from 'lucide-react';
import { LabelForm } from '#/components/board/labels/label-form';
import {
    useCreateLabel,
    useDeleteLabel,
    useToggleCardLabel,
    useUpdateLabel,
} from '#/components/board/labels/label-mutations';
import { LabelChip } from '#/components/board/labels/label-strip';
import {
    ResponsivePopover,
    ResponsivePopoverContent,
    ResponsivePopoverTrigger,
} from '#/components/responsive-popover';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { labelCardCount } from '#/lib/boards';
import { boardQueryOptions } from '#/lib/boards-query';
import type { Card } from '#/lib/boards-query';
import { filterLabels, labelName } from '#/lib/labels';
import type { Label } from '#/lib/labels';
import { labelsQueryOptions } from '#/lib/labels-query';

enum Screen {
    List = 'list',
    Create = 'create',
    Edit = 'edit',
    Delete = 'delete',
}

type ScreenState =
    | { screen: Screen.List }
    | { screen: Screen.Create }
    | { screen: Screen.Edit; labelId: string }
    | { screen: Screen.Delete; labelId: string };

const LIST: ScreenState = { screen: Screen.List };

const SCREEN_TITLES: Record<Screen, string> = {
    [Screen.List]: 'Labels',
    [Screen.Create]: 'Create label',
    [Screen.Edit]: 'Edit label',
    [Screen.Delete]: 'Delete label?',
};

/** Where the back arrow leads: Delete → Edit, Create / Edit → the list. */
function previousScreen(state: ScreenState): ScreenState | undefined {
    if (state.screen === Screen.List) return undefined;
    if (state.screen === Screen.Delete) {
        return { screen: Screen.Edit, labelId: state.labelId };
    }
    return LIST;
}

export interface LabelsPopoverProps {
    boardId: string;
    card: Card;
    // Controlled by the card window: the trigger switches from the "Labels"
    // button to the labels block once a label is on, and the popover stays open.
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// The labels of the board for one card (#120): screens list → create / edit →
// delete inside one popover (a bottom sheet on mobile), with a back arrow.
export function LabelsPopover({
    boardId,
    card,
    open,
    onOpenChange,
    children,
}: LabelsPopoverProps & { children: ReactNode }) {
    const [state, setState] = useState<ScreenState>(LIST);
    const previous = previousScreen(state);

    return (
        <ResponsivePopover
            open={open}
            onOpenChange={(next) => {
                // Every opening starts from the list.
                if (!next) setState(LIST);
                onOpenChange(next);
            }}
        >
            <ResponsivePopoverTrigger asChild>
                {children}
            </ResponsivePopoverTrigger>
            <ResponsivePopoverContent
                title={SCREEN_TITLES[state.screen]}
                onBack={previous && (() => setState(previous))}
            >
                <LabelsScreens
                    boardId={boardId}
                    card={card}
                    state={state}
                    onNavigate={setState}
                />
            </ResponsivePopoverContent>
        </ResponsivePopover>
    );
}

interface LabelsScreensProps {
    boardId: string;
    card: Card;
    state: ScreenState;
    onNavigate: (state: ScreenState) => void;
}

// Mounted only while the popover is open: the queries run for an open popover.
function LabelsScreens({
    boardId,
    card,
    state,
    onNavigate,
}: LabelsScreensProps) {
    const { data: labels = [] } = useQuery(labelsQueryOptions(boardId));

    if (state.screen === Screen.Create) {
        return (
            <CreateLabelScreen
                boardId={boardId}
                labels={labels}
                onDone={() => onNavigate(LIST)}
            />
        );
    }
    // Edit and Delete show the list instead if the label was deleted meanwhile
    // (another tab).
    const labelId = state.screen === Screen.List ? undefined : state.labelId;
    const label = labels.find((l) => l.id === labelId);
    if (!label) {
        return (
            <LabelListScreen
                boardId={boardId}
                card={card}
                labels={labels}
                onNavigate={onNavigate}
            />
        );
    }
    const edit = () => onNavigate({ screen: Screen.Edit, labelId: label.id });
    if (state.screen === Screen.Edit) {
        return (
            <EditLabelScreen
                boardId={boardId}
                label={label}
                labels={labels}
                onDone={() => onNavigate(LIST)}
                onDelete={() =>
                    onNavigate({ screen: Screen.Delete, labelId: label.id })
                }
            />
        );
    }
    return (
        <DeleteLabelScreen
            boardId={boardId}
            label={label}
            onCancel={edit}
            onDone={() => onNavigate(LIST)}
        />
    );
}

function LabelListScreen({
    boardId,
    card,
    labels,
    onNavigate,
}: {
    boardId: string;
    card: Card;
    labels: Array<Label>;
    onNavigate: (state: ScreenState) => void;
}) {
    const [query, setQuery] = useState('');
    const toggle = useToggleCardLabel(boardId, card.id);
    const shown = filterLabels(labels, query);

    return (
        <div className="grid min-w-0 gap-3">
            {/* autoFocus: back from another screen (or after a delete), focus
                stays in the popover instead of falling out and closing it. */}
            <Input
                autoFocus
                aria-label="Search labels"
                placeholder="Search labels"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {shown.length > 0 ? (
                <ul className="grid gap-1">
                    {shown.map((label) => {
                        const checked = card.labelIds.includes(label.id);
                        const name = labelName(label);
                        return (
                            <li
                                key={label.id}
                                className="flex min-w-0 items-center gap-1"
                            >
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={checked}
                                    aria-label={name}
                                    onClick={() =>
                                        toggle.mutate({
                                            labelId: label.id,
                                            on: !checked,
                                        })
                                    }
                                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                >
                                    <span className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-background">
                                        {checked && (
                                            <CheckIcon className="size-3.5" />
                                        )}
                                    </span>
                                    <LabelChip
                                        label={label}
                                        className="h-7 flex-1 text-left text-sm leading-7"
                                    />
                                </button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Edit label ${name}`}
                                    onClick={() =>
                                        onNavigate({
                                            screen: Screen.Edit,
                                            labelId: label.id,
                                        })
                                    }
                                >
                                    <PencilIcon />
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {labels.length === 0
                        ? 'No labels yet.'
                        : 'No labels found.'}
                </p>
            )}
            <Button
                type="button"
                variant="secondary"
                onClick={() => onNavigate({ screen: Screen.Create })}
            >
                <PlusIcon />
                Create label
            </Button>
        </div>
    );
}

function CreateLabelScreen({
    boardId,
    labels,
    onDone,
}: {
    boardId: string;
    labels: Array<Label>;
    onDone: () => void;
}) {
    const createLabel = useCreateLabel(boardId);
    return (
        <LabelForm
            labels={labels}
            submitText="Create"
            isPending={createLabel.isPending}
            onSubmit={(values) =>
                createLabel.mutate(values, { onSuccess: onDone })
            }
        />
    );
}

function EditLabelScreen({
    boardId,
    label,
    labels,
    onDone,
    onDelete,
}: {
    boardId: string;
    label: Label;
    labels: Array<Label>;
    onDone: () => void;
    onDelete: () => void;
}) {
    const updateLabel = useUpdateLabel(boardId);
    return (
        <LabelForm
            labels={labels}
            label={label}
            submitText="Save"
            isPending={updateLabel.isPending}
            onSubmit={(values) =>
                updateLabel.mutate(
                    { labelId: label.id, ...values },
                    { onSuccess: onDone },
                )
            }
            extraAction={
                <Button type="button" variant="destructive" onClick={onDelete}>
                    Delete
                </Button>
            }
        />
    );
}

function DeleteLabelScreen({
    boardId,
    label,
    onCancel,
    onDone,
}: {
    boardId: string;
    label: Label;
    onCancel: () => void;
    onDone: () => void;
}) {
    const { data: board } = useQuery(boardQueryOptions(boardId));
    const deleteLabel = useDeleteLabel(boardId);
    const count = board ? labelCardCount(board, label.id) : 0;

    return (
        <div className="grid min-w-0 gap-3">
            <p className="text-sm">
                Label{' '}
                <LabelChip
                    label={label}
                    className="h-5 align-middle text-xs leading-5"
                />{' '}
                will be removed from {count} {count === 1 ? 'card' : 'cards'} on
                this board.
            </p>
            <div className="flex gap-2">
                {/* Focus on the safe choice: Enter right away doesn't delete. */}
                <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    autoFocus
                    onClick={onCancel}
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    disabled={deleteLabel.isPending}
                    onClick={() =>
                        deleteLabel.mutate(label.id, { onSuccess: onDone })
                    }
                >
                    {deleteLabel.isPending && (
                        <LoaderCircleIcon className="animate-spin" />
                    )}
                    Delete
                </Button>
            </div>
        </div>
    );
}
