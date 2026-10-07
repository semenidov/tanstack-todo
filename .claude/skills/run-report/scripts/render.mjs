#!/usr/bin/env node
// Final run JSON (schema.md) -> markdown of the [run report] PR comment on stdout.
// Refuses to render while the session fields are empty or out of the dictionaries.
//
//   node render.mjs final.json > comment.md

import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
    console.error('usage: render.mjs <final.json>');
    process.exit(2);
}
const r = JSON.parse(readFileSync(path, 'utf8'));

const CLASSES = ['env', 'tooling', 'test', 'code', 'flaky', 'spec', 'expected'];
const RESULTS = ['pass', 'fail', 'no_tests', 'crash', 'flaky', 'expected_red'];
const OUTCOMES = ['fixed', 'fixed_by_owner', 'rejected_false', 'skipped_nit'];
const SPEC_CHECKS = ['test', 'manual', 'none'];
const SPEC_REF_RE = /^(criterion:\d+|edge:\d+|plan|coding|none)$/;

// ---------- validation ----------

const problems = [];
r.stages.forEach((s, i) => {
    const where = `stages[${i}] ${s.actor}/${s.kind}`;
    if (s.actor === 'impl' && !s.name?.trim())
        problems.push(`${where}: пустое name`);
    (s.runs ?? []).forEach((run, j) => {
        const at = `${where} runs[${j}] ${run.type}/${run.result}`;
        if (!RESULTS.includes(run.result))
            return problems.push(`${at}: result не из словаря`);
        if (run.result === 'pass') return;
        const e = run.error;
        if (!e || !CLASSES.includes(e.class) || !e.text?.trim())
            problems.push(
                `${at}: нужны error.class (${CLASSES.join('|')}) и error.text`,
            );
        else if (e.text.length > 80)
            problems.push(`${at}: error.text длиннее 80 символов`);
        else if (run.result === 'expected_red' && e.class !== 'expected')
            problems.push(`${at}: у expected_red класс expected`);
    });
});
r.findings.forEach((f, i) => {
    const at = `findings[${i}] ${f.id}`;
    if (!OUTCOMES.includes(f.outcome))
        problems.push(`${at}: outcome (${OUTCOMES.join('|')})`);
    if (!SPEC_REF_RE.test(f.spec_ref ?? ''))
        problems.push(`${at}: spec_ref (criterion:N|edge:N|plan|coding|none)`);
    if (!SPEC_CHECKS.includes(f.spec_check))
        problems.push(`${at}: spec_check (${SPEC_CHECKS.join('|')})`);
});
if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
}

// ---------- clean + recount ----------

const runs = r.stages.flatMap((s) => s.runs ?? []);
r.totals.local = Object.fromEntries([
    ['runs', runs.length],
    ...RESULTS.map((k) => [k, runs.filter((x) => x.result === k).length]),
]);
for (const s of r.stages) {
    delete s.draft_files;
    for (const run of s.runs ?? []) delete run.hint;
}

// ---------- markdown ----------

const fmtMin = (m) =>
    m < 60
        ? `${Math.round(m)} мин`
        : `${Math.floor(m / 60)} ч ${Math.round(m % 60)} мин`;
const fmtUsd = (x) => x.toFixed(2).replace('.', ',');
const fmtTok = (n) =>
    n >= 1e6
        ? `${(n / 1e6).toFixed(1).replace('.', ',')} млн`
        : `${Math.round(n / 1e3)} тыс.`;
const VERDICT = {
    ok: 'ок',
    changes: 'правки',
    not_formed: 'не сформирован',
    escalated: 'эскалация',
};
const ACTOR = {
    impl: 'impl',
    ci: 'CI',
    verifier: 'verifier',
    main: 'main',
    owner: 'владелец',
};

const notOk = (list) => list.filter((x) => x.result !== 'pass');
function errorsCell(list) {
    const byClass = new Map();
    // Red phases are counted in the summary line; the cell lists real failures only.
    for (const run of notOk(list).filter((x) => x.result !== 'expected_red')) {
        const e = byClass.get(run.error.class) ?? {
            n: 0,
            text: run.error.text,
        };
        e.n += 1;
        byClass.set(run.error.class, e);
    }
    return (
        [...byClass]
            .map(([cls, e]) => `${cls}${e.n > 1 ? ` ×${e.n}` : ''}: ${e.text}`)
            .join('; ') || '-'
    );
}

const rows = [];
const rounds = [...new Set(r.stages.map((s) => s.round))].sort((a, b) => a - b);
for (const round of rounds) {
    const inRound = r.stages.filter((s) => s.round === round);
    const runCell = (list) =>
        list.length ? `${list.length} / ${notOk(list).length}` : '-';
    // Work stages one per row; docs, ship and wait_ci folded into one row each per round (the JSON keeps them all).
    const FOLD = {
        docs: 'Документация, описание PR',
        ship: 'Коммиты, push, PR, метки',
        wait_ci: 'Ожидание CI',
    };
    const folded = new Set();
    for (const s of inRound) {
        if (s.actor === 'ci') continue;
        if (s.actor === 'impl' && FOLD[s.kind]) {
            if (folded.has(s.kind)) continue;
            folded.add(s.kind);
            const group = inRound.filter(
                (x) => x.actor === 'impl' && x.kind === s.kind,
            );
            const groupRuns = group.flatMap((x) => x.runs ?? []);
            rows.push([
                round,
                'impl',
                `${FOLD[s.kind]}${group.length > 1 ? ` ×${group.length}` : ''}`,
                Math.round(group.reduce((a, x) => a + x.min, 0)),
                runCell(groupRuns),
                groupRuns.length ? errorsCell(groupRuns) : '-',
            ]);
            continue;
        }
        const name = s.kind === 'verify' ? 'Проверка' : s.name;
        rows.push([
            round,
            ACTOR[s.actor],
            name,
            Math.round(s.min),
            s.verdict ? VERDICT[s.verdict] : runCell(s.runs ?? []),
            s.runs?.length ? errorsCell(s.runs) : '-',
        ]);
    }
    const ci = inRound.filter((s) => s.actor === 'ci');
    if (ci.length) {
        const by = (c) => ci.filter((s) => s.conclusion === c).length;
        const parts = [
            `${by('success')} ок`,
            by('failure') && `${by('failure')} упал`,
            by('cancelled') && `${by('cancelled')} отм.`,
        ]
            .filter(Boolean)
            .join(', ');
        rows.push([
            round,
            'CI',
            `CI ×${ci.length}`,
            Math.round(ci.reduce((a, s) => a + s.min, 0)),
            parts,
            '-',
        ]);
    }
}

const t = r.totals;
const l = t.local;
const summary = [
    `до апрува ${fmtMin(t.wall_min)}`,
    `impl: работа ${fmtMin(t.impl_work_min)}, ожидание CI ${fmtMin(t.impl_wait_min)}`,
    `раундов ${t.rounds} (${t.verdicts.map((v) => VERDICT[v]).join(' → ')})`,
    `CI ${t.ci.runs} (${t.ci.success} ок${t.ci.failure ? `, ${t.ci.failure} упал` : ''}${t.ci.cancelled ? `, ${t.ci.cancelled} отм.` : ''})`,
    `локальные запуски ${l.runs}, не ок ${l.runs - l.pass} (flaky ${l.flaky}, red ${l.expected_red})`,
    `токены impl: чтение кэша ${fmtTok(t.impl_tokens.cache_read)}, запись кэша ${fmtTok(t.impl_tokens.cache_write_5m + t.impl_tokens.cache_write_1h)}, output ≈${fmtTok(t.impl_tokens.output_est)}`,
    t.impl_cost_usd
        ? `стоимость impl по API ≈ $${fmtUsd(t.impl_cost_usd.total)} (запись кэша $${fmtUsd(t.impl_cost_usd.cache_write)}, чтение $${fmtUsd(t.impl_cost_usd.cache_read)}, output ≈$${fmtUsd(t.impl_cost_usd.output_est)}; цены на ${t.impl_cost_usd.prices_as_of})`
        : 'стоимость impl: нет цен для модели',
].join(' · ');

// Where the cache was rewritten: by the stage kind that held the pause.
const KIND_LABEL = {
    wait_ci: 'ожидание CI',
    triage: 'между раундами',
    build: 'build',
    e2e: 'e2e',
    schema: 'schema',
    docs: 'docs',
    ship: 'ship',
    explore: 'explore',
};
const c = t.cache;
const cacheLine = c
    ? `Кэш: контекст перезаписан ${String(c.rewrite_ratio).replace('.', ',')}× (запись ${fmtTok(c.writes)} при росте ${fmtTok(c.growth)}) · промахов ${c.misses} (ttl ${c.by_cause.ttl.misses}, prefix ${c.by_cause.prefix.misses}), потеряно ${fmtTok(c.lost_tokens)}, переплата ≈$${fmtUsd(c.overpay_usd)}` +
      (c.misses
          ? `: ${Object.entries(c.by_kind)
                .sort((a, b) => b[1].overpay_usd - a[1].overpay_usd)
                .map(
                    ([k, v]) =>
                        `${KIND_LABEL[k] ?? k} ×${v.misses} $${fmtUsd(v.overpay_usd)}`,
                )
                .join(', ')}`
          : '')
    : null;

const findings = r.findings
    .map(
        (f) =>
            `${f.id} ${f.severity} → ${f.outcome} (${f.spec_ref}, ${f.spec_check})`,
    )
    .join(' · ');

// JSON inside an HTML comment must not contain "-->".
const json = JSON.stringify(r).replace(/-->/g, '--\\u003e');

console.log(
    [
        '[run report]',
        '',
        summary,
        '',
        ...(cacheLine ? [cacheLine, ''] : []),
        '| Раунд | Кто | Этап | Мин | Запуски / не ок | Ошибки |',
        '|---|---|---|---|---|---|',
        ...rows.map(
            (row) =>
                `| ${row.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`,
        ),
        '',
        findings ? `Находки verifier: ${findings}` : 'Находок verifier нет.',
        '',
        '<!-- run-stats:json',
        json,
        '-->',
    ].join('\n'),
);
