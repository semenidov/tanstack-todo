import { expect, it } from 'vitest';
import { checkPush, pushRange } from '../../scripts/pre-push.mjs';

const update = 'refs/heads/task abc refs/heads/task def';
const git = (command: string) =>
    ({ 'rev-parse': 'abc', status: '', 'merge-base': 'base', diff: '' })[
        command
    ] ?? '';

it('rejects multiple branches, another HEAD, and dirty files', () => {
    expect(() => pushRange(`${update}\n${update}`, git)).toThrow('one branch');
    expect(() => pushRange(update.replace('abc', 'old'), git)).toThrow('HEAD');
    expect(() =>
        pushRange(update, (command: string) =>
            command === 'status' ? ' M file' : git(command),
        ),
    ).toThrow('Commit or stash');
});

it('runs mandatory checks and selected groups in order, skips empty groups, and propagates failure', () => {
    const calls: string[][] = [];
    const run = (cli: string, args: string[]) => calls.push([cli, ...args]);
    const changedGit = (command: string) =>
        command === 'diff'
            ? 'src/a.integration.test.ts\0e2e/a.spec.ts\0src/a.test.ts\0e2e/helpers.ts\0'
            : git(command);
    const mandatory = [
        ['typescript/bin/tsc', '--noEmit'],
        ['vitest/vitest.mjs', 'run', '--project', 'unit'],
    ];
    checkPush(update, changedGit, run);
    expect(calls).toEqual([
        ...mandatory,
        [
            'vitest/vitest.mjs',
            'run',
            '--project',
            'integration',
            'src/a.integration.test.ts',
        ],
        [
            '@playwright/test/cli.js',
            'test',
            '--reporter=line',
            'e2e/a\\.spec\\.ts$',
        ],
    ]);
    calls.length = 0;
    checkPush(update, git, run);
    expect(calls).toEqual(mandatory);
    calls.length = 0;
    checkPush('', git, run);
    checkPush('(delete) 0000 refs/heads/task def', git, run);
    expect(calls).toEqual([]);
    expect(() =>
        checkPush(update, changedGit, (cli: string, args: string[]) => {
            run(cli, args);
            if (args.includes('integration')) throw new Error('failed');
        }),
    ).toThrow('failed');
    expect(calls).toHaveLength(3);
});

it('compares the pushed commit with the remote SHA or the first-push merge base', () => {
    const calls: string[][] = [];
    const recordingGit = (...args: string[]) => {
        calls.push(args);
        return git(args[0]);
    };
    expect(pushRange(update, recordingGit)).toEqual(['def', 'abc']);
    expect(calls).toEqual([
        ['rev-parse', 'HEAD'],
        ['status', '--porcelain'],
    ]);

    calls.length = 0;
    expect(
        pushRange(update.replace('def', '0'.repeat(40)), recordingGit),
    ).toEqual(['base', 'abc']);
    expect(calls).toEqual([
        ['rev-parse', 'HEAD'],
        ['status', '--porcelain'],
        ['merge-base', 'origin/master', 'abc'],
    ]);
});
