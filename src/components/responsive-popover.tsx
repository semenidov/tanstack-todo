import { createContext, use, useId, useState } from 'react';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { cn } from 'cn';
import { ArrowLeftIcon, XIcon } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Button } from '#/components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '#/components/ui/drawer';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverTrigger,
} from '#/components/ui/popover';
import { useIsDesktop } from '#/lib/use-media-query';

// A popover on desktop, a bottom sheet (Drawer) on mobile, with the same parts:
// <ResponsivePopover> <ResponsivePopoverTrigger asChild> <ResponsivePopoverContent title>.
// Without a trigger (#133): <ResponsivePopover {...popoverProps}> with the
// props of useAnchoredPopover, and its buttonProps on any plain buttons.

const IsDesktopContext = createContext(true);

/** Marks the buttons of an anchored popover; the value is its id. */
const ANCHOR_BUTTON_ATTRIBUTE = 'data-popover-button';

type Measurable = NonNullable<
    ComponentProps<typeof PopoverAnchor>['virtualRef']
>['current'];

type ExternalAnchor = {
    /** The button rect saved at the click: the popover doesn't follow it. */
    measurable: Measurable | null;
    /** Clicks on the buttons with this id aren't outside: they toggle. */
    buttonId: string;
};

// The anchored popover's id for its content (null: an ordinary popover).
const AnchorButtonIdContext = createContext<string | null>(null);

type ResponsivePopoverProps = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Popover without a trigger, placed at a saved rect (desktop only). */
    anchor?: ExternalAnchor;
    children: ReactNode;
};

export function ResponsivePopover({
    anchor,
    children,
    ...props
}: ResponsivePopoverProps) {
    const isDesktop = useIsDesktop();
    const Root = isDesktop ? Popover : Drawer;
    return (
        <IsDesktopContext value={isDesktop}>
            <AnchorButtonIdContext value={anchor?.buttonId ?? null}>
                <Root {...props}>
                    {isDesktop && anchor?.measurable && (
                        <PopoverAnchor
                            virtualRef={{ current: anchor.measurable }}
                        />
                    )}
                    {children}
                </Root>
            </AnchorButtonIdContext>
        </IsDesktopContext>
    );
}

/** Props of the plain buttons that open an anchored popover. */
export type PopoverButtonProps = {
    [ANCHOR_BUTTON_ATTRIBUTE]: string;
    'aria-haspopup': 'dialog';
    'aria-expanded': boolean;
    onClick: (event: MouseEvent<HTMLElement>) => void;
};

/**
 * A popover opened by plain buttons instead of a Radix trigger: its root lives
 * apart from the buttons, so a button moving or remounting while it's open
 * (another row of the card window) neither closes nor moves it. A button click
 * saves the button rect as the anchor and toggles the popover.
 */
export function useAnchoredPopover() {
    const buttonId = useId();
    const [open, setOpen] = useState(false);
    // Created once per click: Popper compares it by reference on every render.
    // Kept after closing, so the closing animation stays in place.
    const [measurable, setMeasurable] = useState<Measurable | null>(null);

    const buttonProps: PopoverButtonProps = {
        [ANCHOR_BUTTON_ATTRIBUTE]: buttonId,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        onClick: (event) => {
            if (open) {
                setOpen(false);
                return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            setMeasurable({ getBoundingClientRect: () => rect });
            setOpen(true);
        },
    };
    return {
        open,
        buttonProps,
        popoverProps: {
            open,
            onOpenChange: setOpen,
            anchor: { measurable, buttonId },
        },
    };
}

export function ResponsivePopoverTrigger(
    props: ComponentProps<typeof PopoverTrigger>,
) {
    const isDesktop = use(IsDesktopContext);
    return isDesktop ? (
        <PopoverTrigger {...props} />
    ) : (
        <DrawerTrigger {...props} />
    );
}

type ResponsivePopoverContentProps = {
    /** Header text; also the accessible name of the popover or sheet. */
    title: ReactNode;
    /** Shows a back arrow in the header: for screens inside one popover. */
    onBack?: () => void;
    /** Popover alignment to the trigger (desktop only). */
    align?: ComponentProps<typeof PopoverContent>['align'];
    className?: string;
    children: ReactNode;
};

export function ResponsivePopoverContent({
    title,
    onBack,
    align = 'start',
    className,
    children,
}: ResponsivePopoverContentProps) {
    const isDesktop = use(IsDesktopContext);
    const anchorButtonId = use(AnchorButtonIdContext);
    const titleId = useId();

    if (isDesktop) {
        return (
            <PopoverContent
                align={align}
                aria-labelledby={titleId}
                // A click on an own button toggles the popover by itself; as an
                // outside click it would close the popover and the click would
                // open it again.
                onInteractOutside={(event) => {
                    if (
                        anchorButtonId !== null &&
                        event.target instanceof Element &&
                        event.target.closest(
                            `[${ANCHOR_BUTTON_ATTRIBUTE}="${anchorButtonId}"]`,
                        )
                    ) {
                        event.preventDefault();
                    }
                }}
                // A tall popover (the due date calendar) scrolls instead of
                // leaving the viewport on short screens.
                className="flex max-h-(--radix-popover-content-available-height) w-72 flex-col p-0"
            >
                <div className="flex items-center gap-1 border-b px-2 py-1.5">
                    <BackButton onBack={onBack} />
                    <h2
                        id={titleId}
                        className="min-w-0 flex-1 truncate px-1 text-sm font-semibold"
                    >
                        {title}
                    </h2>
                    <PopoverPrimitive.Close asChild>
                        <CloseButton />
                    </PopoverPrimitive.Close>
                </div>
                <div className={cn('overflow-y-auto p-3', className)}>
                    {children}
                </div>
            </PopoverContent>
        );
    }

    return (
        <DrawerContent>
            <DrawerHeader className="flex-row items-center gap-1 p-2">
                <BackButton onBack={onBack} />
                <DrawerTitle className="min-w-0 flex-1 truncate px-1 text-left">
                    {title}
                </DrawerTitle>
                <DrawerClose asChild>
                    <CloseButton />
                </DrawerClose>
            </DrawerHeader>
            <div className={cn('overflow-y-auto px-4 pb-4', className)}>
                {children}
            </div>
        </DrawerContent>
    );
}

function BackButton({ onBack }: { onBack?: () => void }) {
    if (!onBack) return null;
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            onClick={onBack}
        >
            <ArrowLeftIcon />
        </Button>
    );
}

function CloseButton(props: ComponentProps<typeof Button>) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            {...props}
        >
            <XIcon />
        </Button>
    );
}
