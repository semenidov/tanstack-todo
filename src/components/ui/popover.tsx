import * as React from 'react';
import { cn } from 'cn';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { POPUP_COLLISION_PADDING } from '#/components/ui/popup-position';

function Popover({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
    return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
    return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

// A popover opened inside a modal Dialog (the card window) is portaled to
// <body>, outside the dialog's scroll lock: react-remove-scroll's document
// listener would cancel the wheel over it, and the popover would scroll only by
// its scrollbar. Stopping the wheel on the popover keeps it from that listener;
// the page under it is locked by the dialog anyway. React's onWheel inside a
// popover won't fire for the same reason (React listens on the document).
function stopWheel(node: HTMLDivElement | null) {
    if (!node) return;
    const stop = (event: WheelEvent) => event.stopPropagation();
    node.addEventListener('wheel', stop);
    return () => node.removeEventListener('wheel', stop);
}

function PopoverContent({
    className,
    align = 'center',
    sideOffset = 4,
    collisionPadding = POPUP_COLLISION_PADDING,
    ...props
}: Omit<React.ComponentProps<typeof PopoverPrimitive.Content>, 'ref'>) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                ref={stopWheel}
                data-slot="popover-content"
                align={align}
                sideOffset={sideOffset}
                collisionPadding={collisionPadding}
                className={cn(
                    'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                    className,
                )}
                {...props}
            />
        </PopoverPrimitive.Portal>
    );
}

function PopoverAnchor({
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
    return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="popover-header"
            className={cn('flex flex-col gap-1 text-sm', className)}
            {...props}
        />
    );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<'h2'>) {
    return (
        <div
            data-slot="popover-title"
            className={cn('font-medium', className)}
            {...props}
        />
    );
}

function PopoverDescription({
    className,
    ...props
}: React.ComponentProps<'p'>) {
    return (
        <p
            data-slot="popover-description"
            className={cn('text-muted-foreground', className)}
            {...props}
        />
    );
}

export {
    Popover,
    PopoverTrigger,
    PopoverContent,
    PopoverAnchor,
    PopoverHeader,
    PopoverTitle,
    PopoverDescription,
};
