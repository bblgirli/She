const webpush = require('web-push');

function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));}

module.exports=async(req,res)=>{
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const {subscription,data}=body;
    if(!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth) return json(res,400,{ok:false,error:'Invalid push subscription'});
    const publicKey=process.env.VAPID_PUBLIC_KEY||process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||process.env.WEB_PUSH_PUBLIC_KEY;
    const privateKey=process.env.VAPID_PRIVATE_KEY||process.env.WEB_PUSH_PRIVATE_KEY;
    const subject=process.env.VAPID_SUBJECT||process.env.WEB_PUSH_SUBJECT||'mailto:admin@m3ss3nger.app';
    if(!publicKey||!privateKey) return json(res,500,{ok:false,error:'VAPID environment variables are missing',missing:[...(!publicKey?['VAPID_PUBLIC_KEY']:[]),...(!privateKey?['VAPID_PRIVATE_KEY']:[])]});
    webpush.setVapidDetails(subject,publicKey,privateKey);
    await webpush.sendNotification(subscription,JSON.stringify(data||{}),{TTL:data?.type==='incoming_call'?60:86400,urgency:data?.type==='incoming_call'?'high':'normal'});
    return json(res,200,{ok:true,delivered:true});
  }catch(error){
    console.error('WEB PUSH ERROR',error);
    const raw=error?.body;
    let detail=raw;
    if(typeof raw==='string'){try{detail=JSON.parse(raw)}catch(_){} }
    const status=error?.statusCode===404||error?.statusCode===410?410:502;
    return json(res,status,{ok:false,error:typeof detail==='object'?detail:(detail||error?.message||'Push delivery failed'),statusCode:error?.statusCode||null});
  }
};
