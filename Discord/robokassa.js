const crypto = require('crypto');
const { CONFIG } = require('./config');

function buildRobokassaUrl(userId, targetUserId = null, invoiceId = null, itemType='vip', amount=null, itemName=null) {
  const outSum = Number(amount ?? CONFIG.ROBOKASSA_VIP_SUM).toFixed(2);
  const invId = invoiceId || String(Date.now());
  const params = new URLSearchParams();
  params.set('MerchantLogin', CONFIG.ROBOKASSA_LOGIN);
  params.set('OutSum', outSum);
  params.set('InvId', invId);
  params.set('Description', itemName ? `Покупка ${itemName}` : 'Покупка VIP в межсерверном боте');
  params.set('Culture', 'ru'); params.set('Encoding','utf-8');
  params.set('Shp_discord_id', String(userId));
  params.set('Shp_target_user_id', String(targetUserId || userId));
  params.set('Shp_item_type', String(itemType));
  const shpParams = Array.from(params.entries()).filter(([k])=>k.startsWith('Shp_')).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`);
  const signature = crypto.createHash('md5').update([CONFIG.ROBOKASSA_LOGIN,outSum,invId,CONFIG.ROBOKASSA_PASSWORD1,...shpParams].join(':')).digest('hex').toUpperCase();
  params.set('SignatureValue',signature);
  return {url:`https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`,invoiceId:invId};
}
function verifyRobokassaSignature(body){
  const {OutSum,InvId,SignatureValue,Shp_discord_id,Shp_target_user_id,Shp_item_type}=body;
  const shp=[`Shp_discord_id=${Shp_discord_id}`,`Shp_item_type=${Shp_item_type||'vip'}`];
  if(Shp_target_user_id) shp.push(`Shp_target_user_id=${Shp_target_user_id}`);
  shp.sort();
  const hash=crypto.createHash('md5').update([String(OutSum),String(InvId),CONFIG.ROBOKASSA_PASSWORD2,...shp].join(':')).digest('hex').toUpperCase();
  return hash===String(SignatureValue).toUpperCase();
}
module.exports={buildRobokassaUrl,verifyRobokassaSignature};
