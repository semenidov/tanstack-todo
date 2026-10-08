#!/bin/sh
# Wait until the ci.yml run (event pull_request) for a PR head SHA completes.
# Usage: scripts/wait-ci.sh <PR> <HEAD_SHA>
# Prints `success <run-id> <url>` and exits 0 when the latest pull_request run
# for the SHA concluded success (migrate is skipped on PRs); prints
# `failed <run-id> <url> (<conclusion>)` plus the failed job names and exits 1
# on any other conclusion; exits 2 on bad arguments; prints `timeout` and exits
# 3 after the total timeout; prints `cancelled <run-id> <url>` and exits 4 when
# a newer push superseded the run (ci.yml cancel-in-progress). Logs are not
# printed: the main session reads `gh run view <id> --log-failed` itself
# (CONTRIBUTING.md «Цикл»).
# Env overrides (debug): WAIT_CI_INTERVAL (s, default 60),
# WAIT_CI_TIMEOUT (s, default 2400 = 40 min; ci.yml jobs have no timeout-minutes).

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

interval=${WAIT_CI_INTERVAL:-60}
timeout=${WAIT_CI_TIMEOUT:-2400}

# Latest pull_request run by createdAt for this SHA, as "id status conclusion url".
filter='[.[] | select(.headSha == "'"$sha"'" and .event == "pull_request")]
  | sort_by(.createdAt) | last // empty
  | "\(.databaseId) \(.status) \(.conclusion) \(.url)"'

start=$(date +%s)
while :; do
    # A gh failure (network, TLS timeout) just skips this iteration; an empty
    # result means the run is not registered yet right after the push.
    if run=$(gh run list --workflow ci.yml --commit "$sha" --limit 20 \
        --json databaseId,headSha,event,status,conclusion,createdAt,url \
        --jq "$filter" 2>/dev/null); then
        if [ -n "$run" ]; then
            set -- $run
            id=$1 status=$2 conclusion=$3 url=$4
            if [ "$status" = completed ]; then
                case $conclusion in
                    success)
                        echo "success $id $url"
                        exit 0
                        ;;
                    cancelled)
                        echo "cancelled $id $url"
                        exit 4
                        ;;
                    *)
                        echo "failed $id $url ($conclusion)"
                        gh run view "$id" --json jobs \
                            --jq '.jobs[] | select(.conclusion == "failure" or .conclusion == "timed_out" or .conclusion == "cancelled") | "  job: \(.name) - \(.conclusion)"' \
                            2>/dev/null
                        exit 1
                        ;;
                esac
            fi
        fi
    else
        echo "wait-ci: gh failed, retrying (PR #$pr)" >&2
    fi
    now=$(date +%s)
    if [ $((now - start + interval)) -gt "$timeout" ]; then
        echo timeout
        exit 3
    fi
    sleep "$interval"
done
