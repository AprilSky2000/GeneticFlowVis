#!/bin/bash

# 第一个参数是端口号
PORT=$1

if inotifywait -e modify,create,delete -r -t 60 csv; then
  pkill -f "runserver 0.0.0.0:$PORT"
  nohup /root/anaconda3/bin/python manage.py runserver 0.0.0.0:$PORT 2>&1 &
fi

# * * * * * cd /home/xfl/pyCode/GFVisTest && ./monitor.sh 9002
# * * * * * cd /home/xfl/pyCode/GFVis && ./monitor.sh 9001