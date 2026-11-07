import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function selectTests(files) {
    return {
        integration: files.filter((file) =>
            /^src\/.*\.integration\.(test|spec)\.tsx?$/.test(file),
        ),
        e2e: files.filter(
            (file) =>
                file === 'e2e/auth.setup.ts' ||
                /^e2e\/.*\.(test|spec)\.[cm]?[jt]sx?$/.test(file),
        ),
    };
}

export function pushRange(input, git) {
    const lines = input.trim().split('\n').filter(Boolean);
    if (!lines.length) return null;
    if (lines.length !== 1) throw new Error('Push one branch at a time.');
    const [localRef, localSha, remoteRef, remoteSha] = lines[0]
        .trim()
        .split(/\s+/);
    if (/^0+$/.test(localSha)) return null;
    if (
        !localRef.startsWith('refs/heads/') ||
        !remoteRef?.startsWith('refs/heads/')
    ) {
        throw new Error('Push the current HEAD as a single branch.');
    }
    if (localSha !== git('rev-parse', 'HEAD').trim())
        throw new Error('Only the current HEAD can be checked.');
    if (git('status', '--porcelain').trim())
        throw new Error('Commit or stash working-tree changes before pushing.');
    const base = /^0+$/.test(remoteSha)
        ? git('merge-base', 'origin/master', localSha).trim()
        : remoteSha;
    return [base, localSha];
}

export function checkPush(input, git, run) {
    const range = pushRange(input, git);
    if (!range) return;
    // Disable rename detection: a renamed test is an addition at its new path.
    const files = git(
        'diff',
        '--name-only',
        '-z',
        '--no-renames',
        '--diff-filter=AM',
        ...range,
        '--',
    )
        .split('\0')
        .filter(Boolean);
    const { integration, e2e } = selectTests(files);
    checkTypes(run);
    runUnitTests(run);
    runIntegrationTests(integration, run);
    runE2eTests(e2e, run);
}

function checkTypes(run) {
    run('typescript/bin/tsc', ['--noEmit']);
}

function runUnitTests(run) {
    run('vitest/vitest.mjs', ['run', '--project', 'unit']);
}

function runIntegrationTests(files, run) {
    if (!files.length) return;
    console.log('Pre-push integration:', files.join(', '));
    run('vitest/vitest.mjs', ['run', '--project', 'integration', ...files]);
}

function runE2eTests(files, run) {
    if (!files.length) return;
    console.log('Pre-push e2e:', files.join(', '));
    const filters = files.map(
        (file) => `${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    );
    run('@playwright/test/cli.js', ['test', '--reporter=line', ...filters]);
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
    try {
        checkPush(
            readFileSync(0, 'utf8'),
            (...args) => execFileSync('git', args, { encoding: 'utf8' }),
            (cli, args) =>
                execFileSync(
                    process.execPath,
                    [resolve('node_modules', cli), ...args],
                    { stdio: 'inherit' },
                ),
        );
    } catch (error) {
        console.error(`Pre-push failed: ${error.message}`);
        process.exitCode = 1;
    }
}
