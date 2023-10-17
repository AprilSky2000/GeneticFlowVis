# 获取当前时间和24小时前的时间
now=$(date +%d/%b/%Y:%H:%M:%S)
one_day_ago=$(date -d '24 hours ago' +%d/%b/%Y:%H:%M:%S)

# 打印最后几条
echo -e "\033[33mPast 20 Request\033[0m"
awk '($NF ~ /^[0-9.]+$/){print $0}' /var/log/nginx/access.log | tail -20

# 分析过去24h日志的请求平均耗时
echo -e "\033[33mAverage Request time\033[0m"
awk -v start="$one_day_ago" -v end="$now" 'BEGIN { total_time=0; count=0; }
$4 > "["start && $4 < "["end && $NF ~ /^[0-9.]+$/ {
  total_time += $NF; count++;
}
END {
  if(count > 0) {
    print "Average request time in last 24 hours: " total_time/count "s";
  } else {
    print "No requests in the last 24 hours.";
  }
}' /var/log/nginx/access.log


# 打印最后几条访问 GET /index/ 的请求
echo -e "\033[33mPast 20 Request on 'GET /index/'\033[0m"
grep 'GET /index/' /var/log/nginx/access.log | tail -n 5

# 分析过去24h访问 GET /index/ 的请求平均耗时
echo -e "\033[33mAverage Request time on 'GET /index/'\033[0m"
awk -v start="$one_day_ago" -v end="$now" 'BEGIN { total_time=0; count=0; } $4 > "["start && $4 < "["end && $6 == "\"GET" && $7 ~ /^\/index\// && $NF ~ /^[0-9.]+$/ { total_time += $NF; count++; } END { if(count > 0) { print "Average request time for '\''GET /index/'\'' in last 24 hours: " total_time/count "s"; } else { print "No '\''GET /index/'\'' requests in the last 24 hours."; } }' /var/log/nginx/access.log
