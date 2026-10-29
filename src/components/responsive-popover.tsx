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

const IsDesktopContext = createContext(true);

const ANCHOR_BUTTON_ATTRIBUTE = 'data-popover-button';

type Measurable = NonNullable<
    ComponentProps<typeof PopoverAnchor>['virtualRef']
>['current'];

type ExternalAnchor = {
    measurable: Measurable | null;
    buttonId: string;
};

const AnchorButtonIdContext = createContext<string | null>(null);

type ResponsivePopoverProps = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
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

export type PopoverButtonProps = {
    [ANCHOR_BUTTON_ATTRIBUTE]: string;
    'aria-haspopup': 'dialog';
    'aria-expanded': boolean;
    onClick: (event: MouseEvent<HTMLElement>) => void;
};

export function useAnchoredPopover() {
    const buttonId = useId();
    const [open, setOpen] = useState(false);
    // Created once per click: Popper compares it by reference.
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
    title: ReactNode;
    onBack?: () => void;
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
                // An own button toggles the popover itself; as an outside click it would
                // close and reopen it.
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
