const SHOP_VIP = [
  { id:'vip1', name:'VIP I', level:1, price:149 },
  { id:'vip2', name:'VIP II', level:2, price:299 },
  { id:'vip3', name:'VIP III', level:3, price:499 },
];

const SHOP_PREFIXES = [
  { id:'classic', name:'Classic', preview:'[VIP]', price:49 },
  { id:'diamond', name:'Diamond', preview:'◆', price:99 },
  { id:'royal', name:'Royal', preview:'✦', price:149 },
  { id:'premium', name:'Premium', preview:'꧁✦꧂', price:249 },
  { id:'legend', name:'Legend', preview:'꧁༺★༻꧂', price:399 },
];

const SHOP_COLORS = [
  { id:'blue', name:'Blue', hex:'#5865F2', price:49 },
  { id:'cyan', name:'Cyan', hex:'#00D9FF', price:99 },
  { id:'purple', name:'Purple', hex:'#9B59FF', price:149 },
  { id:'gold', name:'Gold', hex:'#F1C40F', price:249 },
  { id:'rainbow', name:'Rainbow Premium', hex:'#FF4FD8', price:399 },
];

function getShopItem(type,id){
  if(type==='vip') return SHOP_VIP.find(x=>x.id===id);
  return (type==='prefix'?SHOP_PREFIXES:SHOP_COLORS).find(x=>x.id===id);
}

function getCustomPrefixPrice(value){
  const text=String(value||'').trim();
  let price=199;
  const special=(text.match(/[^a-zA-Z0-9а-яА-Я _-]/gu)||[]).length;
  if(text.length>8) price+=50;
  if(text.length>12) price+=100;
  price+=Math.min(special,4)*50;
  return price;
}

module.exports={SHOP_VIP,SHOP_PREFIXES,SHOP_COLORS,getShopItem,getCustomPrefixPrice};
