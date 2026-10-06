#!/bin/bash
# Restart the mock OpenAI server (used by the end-to-end tests)
PIDFILE=/tmp/mock-openai.pid
if [ -f $PIDFILE ]; then kill $(cat $PIDFILE) 2>/dev/null; fi
for p in $(ps -eo pid,cmd | awk '/node.*mock-openai\/server.js|node server.js/ && !/awk/ {print $1}'); do kill $p 2>/dev/null; done
perl -e 'select(undef,undef,undef,0.5)'
PORT=9999 nohup /opt/node24/package/bin/node "$(dirname "$0")/mock-openai/server.js" > /tmp/mock-openai.log 2>&1 &
echo $! > $PIDFILE
perl -e 'select(undef,undef,undef,0.7)'
curl -sf localhost:9999/v1/models > /dev/null && echo "mock running (pid $(cat $PIDFILE))" || { echo "mock failed"; cat /tmp/mock-openai.log; }
