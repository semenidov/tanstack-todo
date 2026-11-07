import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { checkPush, pushRange, selectTests } from '../../scripts/pre-push.mjs';

const update = 'refs/heads/task abc refs/heads/task def';
const git = (command: string) =>
    ({ 'rev-parse': 'abc', status: '', 'merge-base': 'base', diff: '' })[
        command
    ] ?? '';

describe('pre-push', () => {
    it('uses the remote commit, or merge-base for the first push', () => {
        expect(pushRange(update, git)).toEqual(['def', 'abc']);
        expect(pushRange(update.replace('def', '0000'), git)).toEqual([
            'base',
            'abc',
        ]);
    });
    it('skips empty pushes and branch deletion', () => {
        expect(pushRange('', git)).toBeNull();
        expect(pushRange('(delete) 0000 refs/heads/task def', git)).toBeNull();
    });
    it('rejects multiple branches, another HEAD, and dirty files', () => {
        expect(() => pushRange(`${update}\n${update}`, git)).toThrow(
            'one branch',
        );
        expect(() => pushRange(update.replace('abc', 'old'), git)).toThrow(
            'HEAD',
        );
        expect(() =>
            pushRange(update, (command: string) =>
                command === 'status' ? ' M file' : git(command),
            ),
        ).toThrow('Commit or stash');
    });
    it('selects only integration and e2e files', () => {
        expect(
            selectTests([
                'src/a.test.ts',
                'src/a.integration.test.ts',
                'e2e/a.spec.ts',
                'e2e/helpers.ts',
            ]),
        ).toEqual({
            integration: ['src/a.integration.test.ts'],
            e2e: ['e2e/a.spec.ts'],
        });
    });
    it('skips empty groups and stops on command failure', () => {
        const calls: string[] = [];
        checkPush(update, git, (cli: string) => calls.push(cli));
        expect(calls).toEqual(['typescript/bin/tsc', 'vitest/vitest.mjs']);
        expect(() =>
            checkPush(update, git, () => {
                throw new Error('failed');
            }),
        ).toThrow('failed');
    });
    it('runs selected files sequentially with escaped e2e paths', () => {
        const calls: string[][] = [];
        checkPush(
            update,
            (command: string) =>
                command === 'diff'
                    ? 'src/a.integration.test.ts\0e2e/a.spec.ts\0'
                    : git(command),
            (cli: string, args: string[]) => calls.push([cli, ...args]),
        );
        expect(calls[2]).toEqual([
            'vitest/vitest.mjs',
            'run',
            '--project',
            'integration',
            'src/a.integration.test.ts',
        ]);
        expect(calls[3]).toEqual([
            '@playwright/test/cli.js',
            'test',
            '--reporter=line',
            'e2e/a\\.spec\\.ts$',
        ]);
    });
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
        writeFileSync(join(dir, 'e2e/first.spec.ts'), 'first');
        commit();
        writeFileSync(join(dir, 'e2e/second.spec.ts'), 'second');
        const firstPush = commit();
        expect(selected('0'.repeat(40))[0]).toEqual([
            '@playwright/test/cli.js',
            'test',
            '--reporter=line',
            'e2e/first\\.spec\\.ts$',
            'e2e/second\\.spec\\.ts$',
        ]);
        realGit('mv', 'e2e/first.spec.ts', 'e2e/renamed.spec.ts');
        realGit('rm', 'e2e/second.spec.ts');
        commit();
        expect(selected(firstPush)[0]).toEqual([
            '@playwright/test/cli.js',
            'test',
            '--reporter=line',
            'e2e/renamed\\.spec\\.ts$',
        ]);
        const secondPush = realGit('rev-parse', 'HEAD').trim();
        writeFileSync(join(dir, 'README.md'), 'docs only');
        commit();
        expect(selected(secondPush)).toEqual([]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30_000);
