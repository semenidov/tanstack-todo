// Placement of every popup on desktop (popovers, dropdown menus, selects), #120.
// Radix opens them below the trigger (`side="bottom"`, its default), flips to
// the top when there is no room below (`avoidCollisions`, on by default) and
// shifts them along the edge to stay this far from the viewport edges.
export const POPUP_COLLISION_PADDING = 8;
