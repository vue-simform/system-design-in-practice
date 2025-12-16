# Keep API running script
# Prevents Render.com free tier from sleeping
# Visit: https://cron-job.org to set this up

# Ping endpoint every 14 minutes (before 15-min sleep)
*/14 * * * * curl https://YOUR-API-URL.onrender.com/api/feed

# Alternative: Use UptimeRobot.com for free monitoring + keep-alive
