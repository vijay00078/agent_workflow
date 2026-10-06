#!/bin/bash
# Runs every end-to-end test case against the local n8n + mock OpenAI.
# Needs: n8n running on localhost:5678 and the mock (tests/restart-mock.sh).
cd "$(dirname "$0")/.."
NODE=${NODE:-node}
pass=0; fail=0; failed=()
for c in tests/cases/*.js; do
  out=$($NODE tests/run.js "$c" 2>&1)
  if echo "$out" | grep -q "ALL CHECKS PASSED"; then pass=$((pass+1)); echo "PASS  $c";
  else fail=$((fail+1)); failed+=("$c"); echo "FAIL  $c"; echo "$out" | grep -A20 "FAILED CHECKS\|WORKFLOW ERROR\|Error" | head -25; fi
done
echo "----"; echo "$pass passed, $fail failed"
[ $fail -eq 0 ]
