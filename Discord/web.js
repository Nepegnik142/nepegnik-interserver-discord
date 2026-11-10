const express = require('express');
const { CONFIG } = require('./config');
const { getPool, updatePaymentStatus, ensurePaymentSuccess, getPaymentByInvoice, createPayment, setVip } = require('./database');
const { requireApiKey, createEmbed } = require('./utils');
const { sendRelayMessage } = require('./relay');
const { status: voiceStatus } = require('./voice');
const { verifyRobokassaSignature } = require('./robokassa');
const { verifyWebhook, createCheckout } = require('./payments');
const { SHOP_VIP, SHOP_PREFIXES, SHOP_COLORS, getCustomPrefixPrice } = require('./shop');

const ADMIN_HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>InterServer Admin</title>
<style>
body{font-family:system-ui,Arial;background:#0f1115;color:#eee;margin:0;padding:24px}main{max-width:960px;margin:auto;background:#171a21;padding:24px;border-radius:16px}
input,textarea,button{box-sizing:border-box;width:100%;padding:11px;margin:6px 0;border-radius:9px;border:1px solid #303642;background:#101319;color:#fff}button{cursor:pointer;background:#5865f2;border:0;font-weight:600}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:700px){.grid{grid-template-columns:1fr}}
pre{background:#0b0d11;padding:14px;border-radius:10px;overflow:auto;min-height:40px}.muted{color:#9aa3b2}
</style></head><body><main>
<h1>InterServer Admin</h1><p class="muted">API-панель для текстового и голосового межсерверного чата.</p>
<label>API ключ</label><input id="key" value="${CONFIG.API_KEY}" type="password">
<div class="grid"><section><h2>Статус</h2><button onclick="status()">Обновить</button><pre id="status">—</pre></section>
<section><h2>Голос</h2><button onclick="voice()">Обновить</button><pre id="voice">—</pre></section></div>
<section><h2>Текстовый чат</h2><textarea id="text" rows="4" maxlength="2000" placeholder="Сообщение во все подключённые серверы"></textarea><button onclick="send()">Отправить</button><pre id="result">—</pre></section>
<script>
const $=id=>document.getElementById(id);
function headers(){return {'Content-Type':'application/json','x-api-key':$('key').value.trim()}}
async function call(url,opt={}){try{const r=await fetch(url,{...opt,headers:{...headers(),...(opt.headers||{})}});const d=await r.json();return {status:r.status,ok:r.ok,data:d}}catch(e){return{status:0,ok:false,data:{error:e.message}}}}
async function status(){const r=await call('/api/status');$('status').textContent=JSON.stringify(r.data,null,2)}
async function voice(){const r=await call('/api/voice');$('voice').textContent=JSON.stringify(r.data,null,2)}
async function send(){const text=$('text').value.trim();if(!text){$('result').textContent='Введите текст';return}const r=await call('/api/send-chat',{method:'POST',body:JSON.stringify({text,authorTag:'AdminPanel'})});$('result').textContent=JSON.stringify(r.data,null,2)}
status();voice();
</script></main></body></html>`;


const SHOP_CASES = [
  { id:'case_standard', name:'Стандартный кейс', price:99 },
  { id:'case_premium', name:'Премиум кейс', price:249 },
  { id:'case_legend', name:'Легендарный кейс', price:499 },
];

function resolvePurchase(type, itemId, custom, amount) {
  const t = String(type || '').trim();
  const id = String(itemId || '').trim();
  if (t === 'vip') {
    const item = SHOP_VIP.find(x => x.id === id);
    if (!item) throw new Error('Товар VIP не найден');
    return { amount: Number(item.price), name: item.name, metadata: { type:t, itemId:id, level:item.level } };
  }
  if (t === 'prefix') {
    const item = SHOP_PREFIXES.find(x => x.id === id);
    if (!item) throw new Error('Префикс не найден');
    return { amount:Number(item.price), name:item.name, metadata:{type:t,itemId:id,preview:item.preview} };
  }
  if (t === 'color') {
    const item = SHOP_COLORS.find(x => x.id === id);
    if (!item) throw new Error('Цвет не найден');
    return { amount:Number(item.price), name:item.name, metadata:{type:t,itemId:id,hex:item.hex} };
  }
  if (t === 'case') {
    const item = SHOP_CASES.find(x => x.id === id);
    if (!item) throw new Error('Кейс не найден');
    return { amount:Number(item.price), name:item.name, metadata:{type:t,itemId:id} };
  }
  if (t === 'donate') {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1 || value > 1000000) throw new Error('Некорректная сумма доната');
    return { amount:Math.round(value), name:`Донат ${Math.round(value)} ₽`, metadata:{type:t,amount:Math.round(value)} };
  }
  if (t === 'custom_prefix') {
    const value = String(custom || '').trim();
    if (!value || value.length > 32) throw new Error('Кастомный префикс: от 1 до 32 символов');
    const price = getCustomPrefixPrice(value);
    return { amount:Number(price), name:`Кастомный префикс: ${value}`, metadata:{type:t,custom:value} };
  }
  throw new Error('Неизвестный тип покупки');
}

async function activateSuccessfulPurchase(payment) {
  if (!payment) return;
  const status = String(payment.status || '').toLowerCase();
  if (!['success', 'paid', 'overpaid'].includes(status)) return;

  let metadata = {};
  try {
    metadata = typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : (payment.metadata || {});
  } catch {
    metadata = {};
  }

  // VIP активируется только после подтверждённой оплаты.
  if (String(payment.type || '').toLowerCase() === 'vip') {
    const level = Math.max(1, Math.min(10, Number(metadata.level || 1)));
    await setVip(String(payment.target_user_id || payment.user_id), level, null);
  }
}

async function sendPurchaseDM(discordClient, payment, eventStatus = 'pending') {
  if (!discordClient || !payment?.user_id) return false;
  try {
    const user = await discordClient.users.fetch(String(payment.user_id));
    const statusMap = {
      pending: ['🟡 Ожидает оплаты', 0xfee75c],
      awaiting_confirmation: ['🟠 Ожидает подтверждения', 0xfaa61a],
      paid: ['🟢 Оплата получена', 0x57f287],
      success: ['🟢 Покупка оплачена', 0x57f287],
      overpaid: ['🟢 Оплата получена', 0x57f287],
      cancelled: ['🔴 Платёж отменён', 0xed4245],
      failed: ['🔴 Платёж не прошёл', 0xed4245],
      aml_lock: ['🟠 Платёж на проверке', 0xfee75c],
    };
    const [title, color] = statusMap[String(eventStatus).toLowerCase()] || [`Статус: ${eventStatus}`, 0x5865f2];
    const { EmbedBuilder } = require('discord.js');
    const metadata = (() => { try { return typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : (payment.metadata || {}); } catch { return {}; } })();
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setDescription('Ваш заказ в **Nepegnik Interserver**')
      .addFields(
        { name:'Товар', value:String(metadata.name || payment.type || 'Покупка'), inline:true },
        { name:'Сумма', value:`${Number(payment.sum || 0).toFixed(2)} ₽`, inline:true },
        { name:'Заказ', value:String(payment.invoice_id), inline:false },
        { name:'Статус', value:String(eventStatus), inline:true }
      )
      .setTimestamp();
    if (payment.payment_url && ['pending'].includes(String(eventStatus).toLowerCase())) {
      embed.addFields({name:'Оплата',value:`[Открыть страницу оплаты](${payment.payment_url})`,inline:false});
    }
    await user.send({ embeds:[embed] });
    return true;
  } catch (e) {
    console.warn('Purchase DM failed:', e.message);
    return false;
  }
}

function setupWebServer(webhookClient) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.get('/', (_req, res) => res.json({
    ok: true,
    name: 'Nepegnik Interserver API',
    version: '3.5.1',
    transport: 'http',
    port: CONFIG.PORT
  }));
  app.get('/admin', (_req, res) => res.type('html').send(ADMIN_HTML));

  app.get('/api/status', requireApiKey, (_req, res) => {
    const client = require('./bot');
    res.json({
      ok: true,
      service: 'interserver-bot',
      transport: 'http',
      host: '5.83.140.209',
      port: CONFIG.PORT,
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });
  app.get('/api/voice', requireApiKey, (_req, res) => res.json({ ok: true, rooms: voiceStatus() }));
  app.get('/api/admins', requireApiKey, async (_req, res) => {
    try {
      const [rows] = await getPool().query('SELECT user_id, level, added_at FROM admins ORDER BY level DESC');
      res.json({ ok: true, admins: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  app.get('/api/command-permissions', requireApiKey, async (_req, res) => {
    try {
      const [rows] = await getPool().query('SELECT command_name, min_admin_level, hidden, updated_at FROM command_permissions ORDER BY command_name');
      res.json({ ok: true, permissions: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  app.get('/api/messages', requireApiKey, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const [rows] = await getPool().query('SELECT id, author, author_id, guild, guild_id, channel_id, message_id, text, type, status, error, created_at FROM chat_messages ORDER BY id DESC LIMIT ?', [limit]);
      res.json({ ok: true, messages: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  app.post('/api/send-chat', requireApiKey, async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, error: 'text required' });
    try {
      const result = await sendRelayMessage(text, { tag: String(req.body?.authorTag || 'AdminPanel') }, null, { guildName: 'Admin API', color: 0x5865f2 });
      res.json(result);
    } catch (e) {
      res.status(502).json({ ok: false, error: e.message });
    }
  });
  app.get('/api/shop', requireApiKey, (_req, res) => {
    res.json({ ok:true, vip:SHOP_VIP, prefixes:SHOP_PREFIXES, colors:SHOP_COLORS, cases:SHOP_CASES, donateAmounts:[50,100,250,500,1000] });
  });

  app.post('/api/create-purchase', requireApiKey, async (req, res) => {
    try {
      const userId = String(req.body?.userId || '').trim();
      if (!/^\d{15,25}$/.test(userId)) return res.status(400).json({ok:false,error:'Некорректный Discord userId'});
      const product = resolvePurchase(req.body?.type, req.body?.itemId, req.body?.custom, req.body?.amount);
      const created = await createPayment(userId, String(req.body.type), product.amount, userId, { ...product.metadata, name:product.name });
      const checkout = await createCheckout({
        userId,
        targetUserId:userId,
        type:String(req.body.type),
        amount:product.amount,
        metadata:{...product.metadata,name:product.name},
        description:`${product.name} — Nepegnik Interserver`,
        invoiceId:created.invoiceId,
      });
      const payment = await getPaymentByInvoice(created.invoiceId);
      if (checkout?.url) await getPool().query('UPDATE payments SET payment_url=? WHERE id=?',[checkout.url,created.id]);
      const fresh = await getPaymentByInvoice(created.invoiceId);
      await sendPurchaseDM(require('./bot'), fresh || payment, 'pending');
      res.json({ok:true,paymentId:created.id,invoiceId:created.invoiceId,paymentUrl:checkout?.url || checkout?.payment_url || checkout?.link || null});
    } catch (e) {
      console.error('create-purchase error:',e);
      res.status(400).json({ok:false,error:e.message});
    }
  });

  app.post('/api/update-payment', requireApiKey, async (req, res) => {
    const { paymentId, status } = req.body || {};
    if (!paymentId || !status) return res.status(400).json({ ok: false, error: 'paymentId and status required' });
    try {
      const payment = await updatePaymentStatus(paymentId, status);
      if (!payment) return res.status(404).json({ ok: false, error: 'payment not found' });
      await activateSuccessfulPurchase(payment);
      await sendPurchaseDM(require('./bot'), payment, status);
      res.json({ ok: true, payment });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  app.post('/webhooks/2328', async (req, res) => {
    try {
      if (String(CONFIG.PAYMENT_PROVIDER).toLowerCase() !== '2328') return res.status(404).send('Provider disabled');
      if (!verifyWebhook('2328', req.body)) return res.status(401).send('Invalid signature');
      const payload = req.body || {};
      const invoiceId = String(payload.order_id || '');
      if (!invoiceId) return res.status(400).send('Missing order_id');
      const payment = await getPaymentByInvoice(invoiceId);
      if (!payment) return res.status(404).send('Payment not found');

      const status = String(payload.payment_status || '').toLowerCase();
      const terminalSuccess = ['paid', 'overpaid'];
      const terminalCancel = ['cancel'];
      const terminalFail = ['underpaid', 'aml_lock', 'refund_fail'];
      const terminalRefund = ['refund_process', 'refund_paid'];
      let updated;
      if (terminalSuccess.includes(status)) {
        updated = await ensurePaymentSuccess(payment.id);
      } else if (terminalCancel.includes(status)) {
        updated = await updatePaymentStatus(payment.id, 'cancelled');
      } else if (terminalFail.includes(status)) {
        updated = await updatePaymentStatus(payment.id, 'failed');
      } else if (terminalRefund.includes(status)) {
        updated = await updatePaymentStatus(payment.id, status);
      } else {
        updated = await updatePaymentStatus(payment.id, status || 'pending');
      }
      await sendPurchaseDM(require('./bot'), updated || payment, status || 'pending');
      if (webhookClient) webhookClient.send({ embeds: [createEmbed({ title: '2328 Payment', description: `${payment.user_id} • ${status} • ${invoiceId}`, color: (status === 'paid' || status === 'overpaid') ? 0x57f287 : 0xed4245 })] }).catch(console.error);
      return res.send('OK');
    } catch (e) {
      console.error('2328 webhook error:', e);
      return res.status(500).send('Webhook error');
    }
  });

  app.post('/robokassa', async (req, res) => {
    const body = req.method === 'GET' ? req.query : req.body;
    if (!verifyRobokassaSignature(body)) return res.status(403).send('Signature mismatch');
    const invoiceId = String(body.InvId || body.inv_id || '');
    const payment = await getPaymentByInvoice(invoiceId);
    if (!payment) return res.status(404).send('Payment not found');
    await ensurePaymentSuccess(payment.id);
        const paidPayment = await getPaymentByInvoice(invoiceId);
        await activateSuccessfulPurchase(paidPayment);
        await sendPurchaseDM(require('./bot'), paidPayment, 'paid');
    if (webhookClient) webhookClient.send({ embeds: [createEmbed({ title: 'Payment succeeded', description: `User ${payment.user_id}`, color: 0x57f287 })] }).catch(console.error);
    res.send('OK');
  });
  return app;
}

module.exports = { setupWebServer };