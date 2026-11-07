import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

it('selects only this push using a real Git history', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pre-push-'));
    const realGit = (...args: string[]) =>
        execFileSync('git', args, {
            cwd: dir,
            encoding: 'utf8',
            env: Object.fromEntries(
                Object.entries(process.env).filter(
                    ([key]) => !key.startsWith('GIT_'),
                ),
            ),
        });
    const commit = () => {
        realGit('add', '.');
        realGit(
            '-c',
            'user.name=Test',
            '-c',
            'user.email=test@example.com',
            '-c',
            'core.hooksPath=/dev/null',
            'commit',
            '-m',
            'test',
        );
        return realGit('rev-parse', 'HEAD').trim();
    };
    const selected = (remote: string) => {
        const calls: string[][] = [];
        const head = realGit('rev-parse', 'HEAD').trim();
        checkPush(
            `refs/heads/task ${head} refs/heads/task ${remote}`,
            realGit,
            (cli: string, args: string[]) => calls.push([cli, ...args]),
        );
        return calls.slice(2);
    };
    try {
        realGit('init');
        writeFileSync(join(dir, 'README.md'), 'base');
        const base = commit();
        realGit('update-ref', 'refs/remotes/origin/master', base);
        mkdirSync(join(dir, 'e2e'));
        mkdirSync(join(dir, 'src'));
        writeFileSync(join(dir, 'src/a.integration.test.ts'), 'first');
        writeFileSync(join(dir, 'e2e/auth.setup.ts'), 'setup');
        writeFileSync(join(dir, 'e2e/first.spec.ts'), 'first');
        commit();
        writeFileSync(join(dir, 'e2e/second.spec.ts'), 'second');
        const firstPush = commit();
        expect(selected('0'.repeat(40))).toEqual([
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
                'e2e/auth\\.setup\\.ts$',
                'e2e/first\\.spec\\.ts$',
                'e2e/second\\.spec\\.ts$',
            ],
        ]);
        realGit('mv', 'e2e/first.spec.ts', 'e2e/renamed.spec.ts');
        realGit('rm', 'e2e/second.spec.ts');
        writeFileSync(join(dir, 'src/a.integration.test.ts'), 'modified');
        writeFileSync(join(dir, 'e2e/auth.setup.ts'), 'modified setup');
        commit();
        expect(selected(firstPush)).toEqual([
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
                'e2e/auth\\.setup\\.ts$',
                'e2e/renamed\\.spec\\.ts$',
            ],
        ]);
        const secondPush = realGit('rev-parse', 'HEAD').trim();
        writeFileSync(join(dir, 'README.md'), 'docs only');
        commit();
        expect(selected(secondPush)).toEqual([]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30_000);
