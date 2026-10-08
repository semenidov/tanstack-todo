#!/usr/bin/env node
// Draft of the run report (schema.md): implementer transcript(s) + gh + git -> draft JSON.
// Read-only: publishes nothing. Fields marked "сессия" in schema.md are left for the main session.
//
//   node collect.mjs --pr 110 --transcript <subagents/agent-<id>.jsonl> [--transcript ...] [--approved <iso>] [--out draft.json]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
    options: {
        pr: { type: 'string' },
        transcript: { type: 'string', multiple: true },
        approved: { type: 'string' },
        out: { type: 'string' },
    },
});
if (!args.pr || !args.transcript?.length) {
    console.error(
        'usage: collect.mjs --pr <N> --transcript <path> [--transcript <path>] [--approved <iso>] [--out <file>]',
    );
    process.exit(2);
}

// gh through the local proxy sometimes fails the TLS handshake: retry network errors.
function run(cmd, argv) {
    for (let attempt = 1; ; attempt++) {
        try {
            return execFileSync(cmd, argv, {
                encoding: 'utf8',
                maxBuffer: 64 << 20,
            }).trim();
        } catch (err) {
            if (
                attempt >= 3 ||
                !/timeout|ECONNRESET|EOF|connection/i.test(String(err.stderr))
            )
                throw err;
            Atomics.wait(
                new Int32Array(new SharedArrayBuffer(4)),
                0,
                0,
                2000 * attempt,
            );
        }
    }
}
const gh = (...argv) => JSON.parse(run('gh', argv));
const ms = (iso) => Date.parse(iso);
const minutes = (a, b) => Math.round((ms(b) - ms(a)) / 6000) / 10;

// ---------- transcript ----------

// Wrong path (empty Windows `output_file`, not a transcript): fail with the path, not a TypeError later.
function badTranscript(path, why) {
    console.error(
        `collect: ${path}: ${why}. Expected an implementer transcript: ~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl`,
    );
    process.exit(2);
}

function loadTranscript(path) {
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    } catch (err) {
        badTranscript(path, err.code ?? err.message);
    }
    const recs = raw
        .split('\n')
        .filter((l) => l.trim())
        .map((l, i) => {
            try {
                return JSON.parse(l);
            } catch {
                return badTranscript(path, `line ${i + 1} is not JSON`);
            }
        });
    if (recs.length === 0) badTranscript(path, 'empty file');
    const calls = [];
    const byId = new Map();
    // message id -> { at, u, model, chars, final }: one message spans several records (one per
    // content block); the input-side usage is the same in all, the output is final only on the
    // record with stop_reason. chars - visible generated text (thinking is omitted in the transcript).
    const usage = new Map();
    for (const r of recs) {
        const msg = r.message;
        if (r.type === 'assistant' && msg?.id && msg.usage) {
            const prev = usage.get(msg.id);
            const chars = (msg.content ?? []).reduce(
                (n, b) =>
                    n +
                    (b.type === 'text'
                        ? b.text.length
                        : b.type === 'tool_use'
                          ? JSON.stringify(b.input ?? {}).length
                          : b.type === 'thinking'
                            ? (b.thinking ?? '').length
                            : 0),
                0,
            );
            usage.set(msg.id, {
                first: prev?.first ?? r.timestamp, // request answered: the pause before it ends here
                at: r.timestamp,
                u: msg.usage,
                model: msg.model,
                chars: (prev?.chars ?? 0) + chars,
                final: Boolean(msg.stop_reason) || Boolean(prev?.final),
            });
        }
        if (!Array.isArray(msg?.content)) continue;
        for (const b of msg.content) {
            if (b.type === 'tool_use') {
                const call = {
                    name: b.name,
                    input: b.input ?? {},
                    start: r.timestamp,
                    end: r.timestamp,
                    text: '',
                    isError: false,
                };
                calls.push(call);
                byId.set(b.id, call);
            } else if (b.type === 'tool_result' && byId.has(b.tool_use_id)) {
                const call = byId.get(b.tool_use_id);
                call.end = r.timestamp;
                call.isError = Boolean(b.is_error);
                call.text =
                    typeof b.content === 'string'
                        ? b.content
                        : (b.content ?? []).map((x) => x.text ?? '').join('\n');
            }
        }
    }
    // A segment (one implementer round) ends with SubagentHandback; the next one starts with the next assistant turn.
    const assistantTimes = recs
        .filter((r) => r.type === 'assistant')
        .map((r) => r.timestamp);
    const segments = [];
    let cur = { start: assistantTimes[0], calls: [] };
    for (const c of calls) {
        if (cur.calls.length === 0 && segments.length > 0)
            cur.start =
                assistantTimes.find((t) => ms(t) > ms(segments.at(-1).end)) ??
                c.start;
        if (c.name === 'SubagentHandback') {
            cur.end = c.end;
            segments.push(cur);
            cur = { calls: [] };
        } else cur.calls.push(c);
    }
    if (cur.calls.length) {
        cur.end = cur.calls.at(-1).end;
        segments.push(cur);
    }
    if (segments.length === 0 || !segments[0].start)
        badTranscript(path, 'no assistant tool calls');
    return { segments, usage: [...usage.values()] };
}

// ---------- call classification ----------

const FILE_RE =
    /(?:src|e2e|drizzle|scripts|\.github|\.claude)\/[\w./$@-]+|DOCUMENTATION\.md|DECISIONS\.md|CODING\.md|playwright\.config\.ts/g;
const BASH_WRITE_RE =
    /\bsed -i\b|\bcat >|\btee\b|open\([^)]*['"]w['"]|\.write\(|\bgit (checkout|restore|stash)\b(?! -b)|\bcp\b|\bmv\b|\brm\b|prettier --write|db:generate|auth\/cli generate/;
const COMMIT_RE = /\bgit commit\b/;

function runType(cmd) {
    // Only commands that execute a check; reading a config (cat vitest.config.ts) is not a run.
    if (/\bplaywright test\b/.test(cmd)) return 'e2e';
    if (/drizzle-kit (migrate|push)\b|ALTER TABLE/i.test(cmd)) return 'migrate';
    if (/npx vitest|vitest run|npm (run )?test(:\w+)?\b/.test(cmd))
        return /integration/.test(cmd) ? 'integration' : 'unit';
    if (/\btsc\b|npm run typecheck/.test(cmd)) return 'typecheck';
    if (/\beslint\b|prettier --check|npm run lint/.test(cmd)) return 'lint';
    return null;
}

function runResult(type, text, isError) {
    if (
        /No test files found|No tests found|no tests/i.test(text) &&
        !/\b\d+ (passed|failed)\b/.test(text)
    )
        return 'no_tests';
    if (type === 'typecheck' || type === 'lint')
        return isError || /error TS\d+|\[warn\]|✖|\d+ problems?/.test(text)
            ? 'fail'
            : 'pass';
    // A migration passes only with a success line: a hung push leaves just its spinner.
    if (type === 'migrate')
        return !isError &&
            !/ECONNRESET|\berror\b|failed|Node\.js v\d+/i.test(text) &&
            /\[✓\]|applied|No changes|\bok\b|done/i.test(text)
            ? 'pass'
            : 'crash';
    if (/\b\d+ failed\b|AssertionError|\bFAIL\b|error TS\d+/.test(text))
        return /error TS\d+/.test(text) && !/\d+ (passed|failed)/.test(text)
            ? 'crash'
            : 'fail';
    if (/\b\d+ flaky\b/.test(text)) return 'flaky';
    if (/\b\d+ passed\b/.test(text)) return 'pass';
    return 'crash';
}

const hint = (text) =>
    (
        text
            .split('\n')
            .reverse()
            .find((l) =>
                /error|fail|expected|timeout|ECONN|not found|no tests/i.test(l),
            ) ??
        text.split('\n').at(-1) ??
        ''
    )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);

const testCommand = (cmd) =>
    (
        cmd.match(
            /npx (?:vitest|playwright)[^;&|>]*|drizzle-kit \w+[^;&|>]*/,
        )?.[0] ?? cmd
    )
        .replace(/\s+/g, ' ')
        .trim();

function classify(call) {
    const cmd = call.name === 'Bash' ? String(call.input.command ?? '') : '';
    const files = [
        ...(call.input.file_path ? [call.input.file_path] : []),
        ...(cmd.match(FILE_RE) ?? []),
    ].map((f) => f.replace(/\\/g, '/'));
    const type = cmd ? runType(cmd) : null;
    const edit =
        ['Write', 'Edit', 'NotebookEdit'].includes(call.name) ||
        BASH_WRITE_RE.test(cmd);
    const commit = COMMIT_RE.test(cmd);
    const ship =
        commit ||
        /\bgit push\b|gh pr (create|ready)|--(add|remove)-label/.test(cmd) ||
        /create_pull_request/.test(call.name);
    const prBody =
        /gh pr edit[^&|;]*--body/.test(cmd) ||
        /update_pull_request/.test(call.name);
    const docsOnly =
        files.length > 0 &&
        files.every((f) => /DOCUMENTATION|DECISIONS|pr-body/.test(f));
    // Files and command patterns decide the kind only for edits and runs: a grep over
    // playwright.config.ts is still reading.
    let kind = null;
    if (/gh pr checks[^&|;]*--watch|gh run watch/.test(cmd)) kind = 'wait_ci';
    else if (ship && !type) kind = 'ship';
    else if (prBody || (edit && docsOnly)) kind = 'docs';
    else if (!edit && !type) kind = null;
    else if (
        type === 'e2e' ||
        files.some((f) => /(^|\/)e2e\/|playwright\.config/.test(f))
    )
        kind = 'e2e';
    else if (
        type === 'migrate' ||
        /drizzle-kit|db:generate|ALTER TABLE|auth\/cli generate/i.test(cmd) ||
        files.some((f) => /(^|\/)(drizzle|src\/db)\//.test(f))
    )
        kind = 'schema';
    else if (edit || type) kind = 'build';
    return {
        kind,
        edit,
        commit,
        run: type
            ? {
                  type,
                  result: runResult(type, call.text, call.isError),
                  at: call.end,
                  cmd: testCommand(cmd),
                  hint: hint(call.text),
              }
            : null,
    };
}

// ---------- stages of one implementer segment ----------

// Input-side usage is exact. Output is exact only for messages with a final usage (#84: 12 of
// 102); for the rest it is estimated as visible chars × tokens-per-char of the final messages,
// which includes their hidden thinking - so output_est is an estimate either way.
let TOKENS_PER_CHAR = 0.3; // fallback; set from the transcripts in "assemble"
const emptyTokens = () => ({
    input: 0,
    cache_write_5m: 0,
    cache_write_1h: 0,
    cache_read: 0,
    output_est: 0,
});
function addMessage(t, m) {
    const u = m.u;
    const w5 = u.cache_creation?.ephemeral_5m_input_tokens;
    const w1h = u.cache_creation?.ephemeral_1h_input_tokens;
    t.input += u.input_tokens ?? 0;
    // Without the breakdown the whole write is counted as 5-minute (the default TTL).
    t.cache_write_5m +=
        w5 ?? (w1h === undefined ? (u.cache_creation_input_tokens ?? 0) : 0);
    t.cache_write_1h += w1h ?? 0;
    t.cache_read += u.cache_read_input_tokens ?? 0;
    t.output_est += m.final
        ? (u.output_tokens ?? 0)
        : Math.round(m.chars * TOKENS_PER_CHAR);
    return t;
}
const tokensBetween = (usage, start, end) =>
    usage
        .filter(({ at }) => ms(at) > ms(start) && ms(at) <= ms(end))
        .reduce(addMessage, emptyTokens());

// API prices, $ per 1M tokens (claude-api skill, price table cached 2026-09-25). Cache write:
// 5-minute TTL 1.25× input, 1-hour 2× input. A model without a row gets cost null.
const PRICES_AS_OF = '2026-09-25';
const PRICES = {
    'claude-opus-5-5': { input: 4, output: 20, cache_read: 0.2 },
    'claude-sonnet-5-5': { input: 2, output: 10, cache_read: 0.2 },
};
function costOf(usage) {
    const c = { input: 0, cache_write: 0, cache_read: 0, output_est: 0 };
    for (const m of usage) {
        const p = PRICES[m.model];
        if (!p) return null;
        const t = addMessage(emptyTokens(), m);
        c.input += (t.input * p.input) / 1e6;
        c.cache_write +=
            (t.cache_write_5m * p.input * 1.25 +
                t.cache_write_1h * p.input * 2) /
            1e6;
        c.cache_read += (t.cache_read * p.cache_read) / 1e6;
        c.output_est += (t.output_est * p.output) / 1e6;
    }
    const r2 = (x) => Math.round(x * 100) / 100;
    return {
        input: r2(c.input),
        cache_write: r2(c.cache_write),
        cache_read: r2(c.cache_read),
        output_est: r2(c.output_est),
        total: r2(c.input + c.cache_write + c.cache_read + c.output_est),
        output_estimated: true,
        models: [...new Set(usage.map((m) => m.model))],
        prices_as_of: PRICES_AS_OF,
    };
}

function segmentStages(seg, round, usage) {
    const items = seg.calls.map((c) => ({ call: c, ...classify(c) }));
    // Reads take the kind of the work around them; reads before the first work call are "explore".
    let seenWork = false;
    let prev = 'explore';
    for (const it of items) {
        if (it.kind) {
            seenWork = true;
            prev = it.kind;
        } else it.kind = seenWork ? prev : 'explore';
    }
    // Flaky: the same check failed, then passed with no edits in between.
    const runs = items.filter((it) => it.run);
    for (let i = 0; i < runs.length; i++) {
        const a = runs[i];
        if (!['fail', 'crash'].includes(a.run.result)) continue;
        const j = runs.findIndex((b, k) => k > i && b.run.cmd === a.run.cmd);
        if (j < 0 || runs[j].run.result !== 'pass') continue;
        const between = items.slice(
            items.indexOf(a) + 1,
            items.indexOf(runs[j]) + 1,
        );
        if (!between.some((it) => it.edit)) a.run.result = 'flaky';
    }
    // Group: a new stage on a kind change or on the first work call after a commit.
    const stages = [];
    let afterCommit = false;
    let edge = seg.start;
    for (const it of items) {
        const last = stages.at(-1);
        if (
            !last ||
            last.kind !== it.kind ||
            (afterCommit && it.kind !== 'ship')
        ) {
            stages.push({
                round,
                actor: 'impl',
                kind: it.kind,
                start: edge,
                end: it.call.end,
                runs: [],
                files: new Set(),
            });
            afterCommit = false;
        }
        const st = stages.at(-1);
        st.end = it.call.end;
        edge = it.call.end;
        if (it.run) st.runs.push(it.run);
        if (it.edit)
            for (const f of (
                String(it.call.input.command ?? '') +
                ' ' +
                (it.call.input.file_path ?? '')
            ).match(FILE_RE) ?? [])
                st.files.add(f);
        if (it.commit) afterCommit = true;
    }
    // Stages under a minute join a neighbour, repeated until stable:
    // - a short work stage (build/schema/e2e/docs) joins the next work stage, else the previous one;
    //   between non-work neighbours (ship, wait_ci) it stays;
    // - a short ship/explore joins the previous stage, else the next one; never a wait_ci.
    const join = (into, st, before) => {
        if (before) into.start = st.start;
        else into.end = st.end;
        into.runs = before
            ? [...st.runs, ...into.runs]
            : [...into.runs, ...st.runs];
        st.files.forEach((f) => into.files.add(f));
    };
    const sameKind = (list) =>
        list.reduce((acc, st) => {
            const last = acc.at(-1);
            if (last && last.kind === st.kind) join(last, st, false);
            else acc.push(st);
            return acc;
        }, []);
    const WORK = ['build', 'schema', 'e2e', 'docs'];
    let list = sameKind(stages);
    for (let changed = true; changed;) {
        changed = false;
        for (let i = 0; i < list.length && !changed; i++) {
            const st = list[i];
            if (st.kind === 'wait_ci' || minutes(st.start, st.end) >= 1)
                continue;
            const prev = list[i - 1];
            const next = list[i + 1];
            const ok = (s) => s && s.kind !== 'wait_ci';
            let target = null;
            if (WORK.includes(st.kind))
                target =
                    next && WORK.includes(next.kind)
                        ? next
                        : prev && WORK.includes(prev.kind)
                          ? prev
                          : null;
            else target = ok(prev) ? prev : ok(next) ? next : null;
            if (!target) continue;
            join(target, st, target === next);
            list.splice(i, 1);
            list = sameKind(list);
            changed = true;
        }
    }
    return list.map((st) => ({
        round: st.round,
        actor: 'impl',
        kind: st.kind,
        name: '',
        draft_files: [...st.files].slice(0, 8),
        start: st.start,
        end: st.end,
        min: minutes(st.start, st.end),
        runs: st.runs.map((r) => ({
            type: r.type,
            result: r.result,
            at: r.at,
            ...(r.result === 'pass'
                ? {}
                : {
                      hint: r.hint,
                      error:
                          r.result === 'flaky'
                              ? {
                                    class: 'flaky',
                                    text: 'упал, повтор без правок прошёл',
                                }
                              : { class: null, text: null },
                  }),
        })),
        tokens: tokensBetween(usage, st.start, st.end),
    }));
}

// ---------- GitHub ----------

const pr = gh(
    'pr',
    'view',
    args.pr,
    '--json',
    'number,headRefName,headRefOid,closingIssuesReferences,comments',
);
const repo = run('gh', [
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '-q',
    '.nameWithOwner',
]);
const ghRuns = gh(
    'run',
    'list',
    '--branch',
    pr.headRefName,
    '--limit',
    '100',
    '--json',
    'workflowName,headSha,conclusion,createdAt,updatedAt',
);
const timeline = run('gh', [
    'api',
    `repos/${repo}/issues/${pr.number}/timeline`,
    '--paginate',
    '--jq',
    '.[] | {event, created_at}',
])
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
const ready =
    timeline.findLast((e) => e.event === 'ready_for_review')?.created_at ??
    null;

const verifierComments = pr.comments
    .filter((c) => c.body.startsWith('[verifier]'))
    .map((c) => {
        // \b does not work with Cyrillic in JS regexps.
        const word = c.body.match(/^\[verifier\]\s+(\S+)/)?.[1];
        const verdict =
            word === 'ок' ? 'ok' : word === 'правки' ? 'changes' : 'not_formed';
        const block = c.body.match(
            /<!-- verifier:json\s*([\s\S]*?)\s*-->/,
        )?.[1];
        let findings = [];
        try {
            findings = block ? (JSON.parse(block).findings ?? []) : [];
        } catch {}
        return {
            at: c.createdAt,
            verdict,
            sha:
                c.body.match(/проверен коммит `([0-9a-f]{7,40})`/)?.[1] ?? null,
            findings,
        };
    });

// ---------- assemble ----------

const transcripts = args.transcript.map(loadTranscript);
const allUsage = transcripts.flatMap((t) => t.usage);
{
    const fin = allUsage.filter((m) => m.final && m.chars > 0);
    const chars = fin.reduce((n, m) => n + m.chars, 0);
    if (chars > 0)
        TOKENS_PER_CHAR =
            fin.reduce((n, m) => n + (m.u.output_tokens ?? 0), 0) / chars;
}
const segments = transcripts.flatMap((t) =>
    t.segments.map((s) => ({ ...s, usage: t.usage })),
);
const implStages = segments.flatMap((s, i) => segmentStages(s, i + 1, s.usage));

const started = segments[0].start;
const approved = args.approved ?? new Date().toISOString();
const verifyRuns = ghRuns
    .filter((r) => /verify/i.test(r.workflowName))
    .sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
const ciRuns = ghRuns.filter(
    (r) =>
        !/verify/i.test(r.workflowName) &&
        ms(r.createdAt) >= ms(started) - 60e3,
);
const roundAt = (iso) =>
    1 + verifyRuns.filter((r) => ms(r.createdAt) <= ms(iso)).length;

const ghStages = [
    ...ciRuns.map((r) => ({
        round: roundAt(r.createdAt),
        actor: 'ci',
        kind: 'ci',
        name: r.workflowName,
        start: r.createdAt,
        end: r.updatedAt,
        min: minutes(r.createdAt, r.updatedAt),
        ref: r.headSha.slice(0, 7),
        conclusion: r.conclusion,
    })),
    ...verifyRuns.map((r, i) => {
        const c = verifierComments.find(
            (v) => v.sha && r.headSha.startsWith(v.sha),
        );
        return {
            round: i + 1,
            actor: 'verifier',
            kind: 'verify',
            name: 'verifier',
            start: r.createdAt,
            end: r.updatedAt,
            min: minutes(r.createdAt, r.updatedAt),
            ref: r.headSha.slice(0, 7),
            verdict: c?.verdict ?? 'not_formed',
        };
    }),
    ...verifierComments
        .filter((v) => v.verdict === 'changes')
        .map((v) => {
            const next = segments.find((s) => ms(s.start) > ms(v.at));
            return (
                next && {
                    round: roundAt(v.at) - 1,
                    actor: 'main',
                    kind: 'triage',
                    name: 'Разбор вердикта',
                    start: v.at,
                    end: next.start,
                    min: minutes(v.at, next.start),
                }
            );
        })
        .filter(Boolean),
    ...(ready
        ? [
              {
                  round: verifyRuns.length,
                  actor: 'owner',
                  kind: 'accept',
                  name: 'Приёмка',
                  start: ready,
                  end: approved,
                  min: minutes(ready, approved),
              },
          ]
        : []),
];

const stages = [...implStages, ...ghStages].sort(
    (a, b) => ms(a.start) - ms(b.start),
);

// ---------- cache: rewrites of the context ----------
// Context of a request = input + cache write + cache read. A request that reads less than the
// previous context lost the cached prefix and wrote it again (a miss). Cause: "ttl" when the pause
// since the previous response is longer than the TTL of the rewrite (5 min or 1 h), else "prefix".
// Losses under MIN_LOST are noise. Overpay = lost × (write price - read price).
const MIN_LOST = 1024;
const round2 = (x) => Math.round(x * 100) / 100;
const segmentOf = (iso) =>
    segments.findIndex(
        (s) => ms(iso) >= ms(s.start) - 1000 && ms(iso) <= ms(s.end) + 1000,
    );
const cache = { writes: 0, growth: 0 };
const misses = [];
for (const t of transcripts) {
    const msgs = [...t.usage].sort((a, b) => ms(a.first) - ms(b.first));
    let prev = null;
    for (const m of msgs) {
        const u = m.u;
        const read = u.cache_read_input_tokens ?? 0;
        const ctx =
            (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + read;
        cache.writes += u.cache_creation_input_tokens ?? 0;
        cache.growth += Math.max(0, ctx - (prev?.ctx ?? 0));
        const lost = prev ? prev.ctx - read : 0;
        if (lost >= MIN_LOST) {
            const gap = minutes(prev.m.at, m.first);
            const oneHour =
                (u.cache_creation?.ephemeral_1h_input_tokens ?? 0) > 0;
            const p = PRICES[m.model];
            misses.push({
                from: prev.m.at,
                at: m.first,
                gap_min: gap,
                lost,
                cause: gap > (oneHour ? 60 : 5) ? 'ttl' : 'prefix',
                overpay_usd: p
                    ? round2(
                          (lost *
                              (p.input * (oneHour ? 2 : 1.25) - p.cache_read)) /
                              1e6,
                      )
                    : null,
            });
        }
        prev = { m, ctx };
    }
}
// A miss belongs to the stage where the pause was: between rounds - the triage stage (else the
// next implementer stage); inside a round - the implementer stage that holds the pause midpoint.
for (const miss of misses) {
    const mid = (ms(miss.from) + ms(miss.at)) / 2;
    const between = segmentOf(miss.from) !== segmentOf(miss.at);
    const stage = between
        ? (stages.find(
              (s) =>
                  s.kind === 'triage' &&
                  Math.abs(ms(s.end) - ms(miss.at)) < 5000,
          ) ?? implStages.find((s) => ms(s.start) >= ms(miss.at) - 5000))
        : implStages.find((s) => ms(s.start) < mid && mid <= ms(s.end));
    miss.kind = stage?.kind ?? null;
    if (stage) (stage.cache_misses ??= []).push(miss);
}
const missSum = (list) => ({
    misses: list.length,
    lost_tokens: list.reduce((n, x) => n + x.lost, 0),
    overpay_usd: round2(list.reduce((n, x) => n + (x.overpay_usd ?? 0), 0)),
});
cache.rewrite_ratio = cache.growth ? round2(cache.writes / cache.growth) : null;
Object.assign(cache, missSum(misses), {
    by_cause: {
        ttl: missSum(misses.filter((x) => x.cause === 'ttl')),
        prefix: missSum(misses.filter((x) => x.cause === 'prefix')),
    },
    by_kind: Object.fromEntries(
        [...new Set(misses.map((x) => x.kind))].map((k) => [
            k,
            missSum(misses.filter((x) => x.kind === k)),
        ]),
    ),
});
for (const miss of misses) {
    delete miss.from;
    delete miss.kind;
}
const allRuns = implStages.flatMap((s) => s.runs);
const count = (pred) => allRuns.filter(pred).length;
const sum = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;

let processSha = null;
try {
    const base = run('git', ['merge-base', pr.headRefOid, 'origin/master']);
    processSha =
        run('git', [
            'log',
            '-1',
            '--format=%h',
            base,
            '--',
            'CONTRIBUTING.md',
            'CODING.md',
            '.claude/agents',
        ]) || null;
} catch {}

const report = {
    schema: 1,
    issue: pr.closingIssuesReferences?.[0]?.number ?? null,
    pr: pr.number,
    process_sha: processSha,
    started,
    approved,
    totals: {
        wall_min: minutes(started, approved),
        impl_work_min: sum(
            implStages.filter((s) => s.kind !== 'wait_ci').map((s) => s.min),
        ),
        impl_wait_min: sum(
            implStages.filter((s) => s.kind === 'wait_ci').map((s) => s.min),
        ),
        rounds: Math.max(segments.length, verifyRuns.length),
        verdicts: ghStages
            .filter((s) => s.kind === 'verify')
            .map((s) => s.verdict),
        ci: {
            runs: ciRuns.length,
            success: ciRuns.filter((r) => r.conclusion === 'success').length,
            failure: ciRuns.filter((r) => r.conclusion === 'failure').length,
            cancelled: ciRuns.filter((r) => r.conclusion === 'cancelled')
                .length,
        },
        local: {
            runs: allRuns.length,
            pass: count((r) => r.result === 'pass'),
            fail: count((r) => r.result === 'fail'),
            no_tests: count((r) => r.result === 'no_tests'),
            crash: count((r) => r.result === 'crash'),
            flaky: count((r) => r.result === 'flaky'),
            expected_red: count((r) => r.result === 'expected_red'),
        },
        // Over the whole transcript, not stage windows: messages at segment edges count too.
        impl_tokens: allUsage.reduce(addMessage, emptyTokens()),
        impl_cost_usd: costOf(allUsage),
        cache,
    },
    stages,
    // A later report repeats earlier findings: keep the round where each id first appeared.
    findings: [
        ...new Map(
            verifierComments
                .flatMap((v, i) =>
                    v.findings.map((f) => ({
                        id: f.id,
                        round: i + 1,
                        severity: f.severity,
                        title: f.title ?? '',
                        outcome: null,
                        spec_ref: null,
                        spec_check: null,
                    })),
                )
                .reverse()
                .map((f) => [f.id, f]),
        ).values(),
    ].sort((a, b) => a.round - b.round || a.id.localeCompare(b.id)),
};

const json = JSON.stringify(report, null, 2);
if (args.out) writeFileSync(args.out, json + '\n');
else console.log(json);
