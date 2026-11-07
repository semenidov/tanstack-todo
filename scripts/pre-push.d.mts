export function selectTests(files: string[]): {
    integration: string[];
    e2e: string[];
};
export function pushRange(
    input: string,
    git: (...args: string[]) => string,
): [string, string] | null;
export function checkPush(
    input: string,
    git: (...args: string[]) => string,
    run: (cli: string, args: string[]) => void,
): void;
