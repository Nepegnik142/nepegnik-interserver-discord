const { CONFIG } = require('./config');

let timer = null;

async function sendSiteHeartbeat() {
  if (!CONFIG.SITE_API_URL || !CONFIG.SITE_API_KEY) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${CONFIG.SITE_API_URL}/api/bot_heartbeat.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-API-Key': CONFIG.SITE_API_KEY,
      },
      body: JSON.stringify({
        service: 'interserver-bot',
        port: CONFIG.PORT,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`Site heartbeat: HTTP ${response.status}`);
      return;
    }

    console.log('Site heartbeat: OK');
  } catch (error) {
    console.warn(`Site heartbeat failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function startSiteHeartbeat() {
  if (!CONFIG.SITE_API_URL || timer) return;
  sendSiteHeartbeat();
  timer = setInterval(sendSiteHeartbeat, 30000);
  if (timer.unref) timer.unref();
}

module.exports = { startSiteHeartbeat, sendSiteHeartbeat };
