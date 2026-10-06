#!/bin/sh
# Wait until the verify.yml run for a PR head SHA completes.
# Usage: scripts/wait-verify.sh <PR> <HEAD_SHA>
# Prints the run JSON and exits 0 when the latest non-skipped run for the SHA
# is completed (any conclusion); prints `timeout` and exits 1 after the total
# timeout; exits 2 on bad arguments. The verdict is read from PR comments by the
# main session (CONTRIBUTING.md «Цикл»), not here.
# Env overrides (debug): WAIT_VERIFY_INTERVAL (s, default 60),
# WAIT_VERIFY_TIMEOUT (s, default 2100 = 35 min, > job timeout-minutes: 30).

usage() {
    echo "usage: $0 <PR> <HEAD_SHA>" >&2
    exit 2
}

[ "$#" -eq 2 ] || usage
pr=$1
sha=$2
case $pr in '' | *[!0-9]*) usage ;; esac
case $sha in '' | *[!0-9a-f]*) usage ;; esac
[ "${#sha}" -eq 40 ] || usage

interval=${WAIT_VERIFY_INTERVAL:-60}
timeout=${WAIT_VERIFY_TIMEOUT:-2100}

# Latest run by createdAt for this SHA; runs skipped by the job `if`
# (labels other than `verify`) are ignored.
filter='[.[] | select(.headSha == "'"$sha"'" and .conclusion != "skipped")]
  | sort_by(.createdAt) | last // empty'

start=$(date +%s)
while :; do
    # A gh failure (network, TLS timeout) just skips this iteration.
    if run=$(gh run list --workflow verify.yml --commit "$sha" --limit 50 \
        --json headSha,status,conclusion,databaseId,createdAt,url \
        --jq "$filter" 2>/dev/null); then
        case $run in
            *'"status":"completed"'*)
                printf '%s\n' "$run"
                exit 0
                ;;
        esac
    else
        echo "wait-verify: gh failed, retrying (PR #$pr)" >&2
    fi
    now=$(date +%s)
    if [ $((now - start + interval)) -gt "$timeout" ]; then
        echo timeout
        exit 1
    fi
    sleep "$interval"
done
