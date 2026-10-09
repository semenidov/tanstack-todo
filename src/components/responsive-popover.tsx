import { createContext, use, useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
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
    PopoverContent,
    PopoverTrigger,
} from '#/components/ui/popover';
import { useIsDesktop } from '#/lib/use-media-query';

// A popover on desktop, a bottom sheet (Drawer) on mobile, with the same parts:
// <ResponsivePopover> <ResponsivePopoverTrigger asChild> <ResponsivePopoverContent title>.

const IsDesktopContext = createContext(true);

type ResponsivePopoverProps = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
};

export function ResponsivePopover({
    children,
    ...props
}: ResponsivePopoverProps) {
    const isDesktop = useIsDesktop();
    const Root = isDesktop ? Popover : Drawer;
    return (
        <IsDesktopContext value={isDesktop}>
            <Root {...props}>{children}</Root>
        </IsDesktopContext>
    );
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
    const titleId = useId();

    if (isDesktop) {
        return (
            <PopoverContent
                align={align}
                aria-labelledby={titleId}
                className="w-72 p-0"
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
                <div className={cn('p-3', className)}>{children}</div>
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
