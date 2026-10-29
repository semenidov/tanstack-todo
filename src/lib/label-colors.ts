export enum LabelColor {
    Green = 'green',
    Lime = 'lime',
    Yellow = 'yellow',
    Orange = 'orange',
    Red = 'red',
    Pink = 'pink',
    Purple = 'purple',
    Blue = 'blue',
    Sky = 'sky',
    Gray = 'gray',
}

export const LABEL_COLORS = Object.values(LabelColor);

export const DEFAULT_LABEL_COLOR = LabelColor.Green;

interface LabelColorStyle {
    name: string;
    className: string;
}

export const LABEL_COLOR_STYLES: Record<LabelColor, LabelColorStyle> = {
    [LabelColor.Green]: {
        name: 'Green',
        className: 'bg-green-600 text-white',
    },
    [LabelColor.Lime]: {
        name: 'Lime',
        className: 'bg-lime-400 text-lime-950',
    },
    [LabelColor.Yellow]: {
        name: 'Yellow',
        className: 'bg-yellow-400 text-yellow-950',
    },
    [LabelColor.Orange]: {
        name: 'Orange',
        className: 'bg-orange-500 text-white',
    },
    [LabelColor.Red]: { name: 'Red', className: 'bg-red-600 text-white' },
    [LabelColor.Pink]: { name: 'Pink', className: 'bg-pink-500 text-white' },
    [LabelColor.Purple]: {
        name: 'Purple',
        className: 'bg-purple-600 text-white',
    },
    [LabelColor.Blue]: { name: 'Blue', className: 'bg-blue-600 text-white' },
    [LabelColor.Sky]: { name: 'Sky', className: 'bg-sky-400 text-sky-950' },
    [LabelColor.Gray]: { name: 'Gray', className: 'bg-zinc-500 text-white' },
};

export function labelColorStyle(color: string): LabelColorStyle {
    const key = LABEL_COLORS.find((c) => c === color) ?? LabelColor.Gray;
    return LABEL_COLOR_STYLES[key];
}
