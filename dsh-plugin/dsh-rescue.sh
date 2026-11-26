#!/bin/sh
export PATH="/home/xuekai/.local/share/fnm/node-versions/v26.13.1/installation/bin:/home/xuekai/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

pm2 start /home/xuekai/.local/share/fnm/node-versions/v26.13.1/installation/bin/npx \
  --name dsh-rescue \
  --interpreter none \
  --time \
  -- --yes @deepseek-ai/dsh@alpha --profile rescue \
  --no-open \
  --port 2008
