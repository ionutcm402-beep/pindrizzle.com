import { createSign, sign as cryptoSign, timingSafeEqual } from "node:crypto";
import * as http2 from "node:http2";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushConfig = {
  vapid_public_key: string | null;
  vapid_private_key: string | null;
  webhook_secret: string | null;
  push_origin: string | null;
  vapid_subject: string | null;
  delivery_enabled: string | null;
};
type NotificationRow = { id:string; user_id:string; ping_id:string|null; kind:string; title:string; body:string };
type SubscriptionRow = { id:string; endpoint:string; p256dh:string; auth_secret:string };
type NativeDeviceRow = { id:string; platform:"ios"|"android"; token:string };
type AttemptRow = { attempt_count:number; delivered_at:string|null };

type NativeSendResult = { ok:boolean; status:number; reason:string };

function safeEqual(left:string,right:string){const a=Buffer.from(left);const b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);}
function isUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
function base64url(value:Buffer|string){return Buffer.from(value).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");}
function notificationPayload(notification:NotificationRow){return{
  notificationId:notification.id,
  title:notification.title.slice(0,120),
  body:notification.body.slice(0,220),
  kind:notification.kind,
  pingId:notification.ping_id,
  url:notification.ping_id?`/#ping=${encodeURIComponent(notification.ping_id)}`:"/alerts",
};}

let firebaseTokenCache:{token:string;expiresAt:number}|null=null;
async function firebaseAccessToken(){
  if(firebaseTokenCache&&firebaseTokenCache.expiresAt>Date.now()+60000)return firebaseTokenCache.token;
  const email=process.env.FIREBASE_CLIENT_EMAIL||"";
  const privateKey=(process.env.FIREBASE_PRIVATE_KEY||"").replace(/\\n/g,"\n");
  if(!email||!privateKey)throw new Error("Firebase service account is not configured");
  const now=Math.floor(Date.now()/1000);
  const header=base64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claims=base64url(JSON.stringify({iss:email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
  const unsigned=`${header}.${claims}`;
  const signer=createSign("RSA-SHA256");signer.update(unsigned);signer.end();
  const assertion=`${unsigned}.${base64url(signer.sign(privateKey))}`;
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  const data=await response.json().catch(()=>({})) as {access_token?:string;expires_in?:number;error_description?:string};
  if(!response.ok||!data.access_token)throw new Error(data.error_description||"Firebase access token failed");
  firebaseTokenCache={token:data.access_token,expiresAt:Date.now()+Math.max(300,Number(data.expires_in||3600))*1000};
  return data.access_token;
}

async function sendFcm(token:string,payload:ReturnType<typeof notificationPayload>):Promise<NativeSendResult>{
  const projectId=process.env.FIREBASE_PROJECT_ID||"";
  if(!projectId)return{ok:false,status:0,reason:"Firebase project is not configured"};
  try{
    const accessToken=await firebaseAccessToken();
    const response=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,{
      method:"POST",
      headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},
      body:JSON.stringify({message:{token,notification:{title:payload.title,body:payload.body},data:{notificationId:payload.notificationId,kind:payload.kind,pingId:payload.pingId||"",url:payload.url},android:{notification:{channel_id:"pindrizzle-updates"}}}}),
    });
    const text=await response.text();
    return{ok:response.ok,status:response.status,reason:response.ok?"":text.slice(0,500)};
  }catch(error){return{ok:false,status:0,reason:error instanceof Error?error.message:"FCM delivery failed"};}
}

function apnsJwt(){
  const keyId=process.env.APNS_KEY_ID||"";
  const teamId=process.env.APNS_TEAM_ID||"";
  const privateKey=(process.env.APNS_PRIVATE_KEY||"").replace(/\\n/g,"\n");
  if(!keyId||!teamId||!privateKey)throw new Error("APNs key is not configured");
  const header=base64url(JSON.stringify({alg:"ES256",kid:keyId}));
  const claims=base64url(JSON.stringify({iss:teamId,iat:Math.floor(Date.now()/1000)}));
  const unsigned=`${header}.${claims}`;
  const signature=cryptoSign("sha256",Buffer.from(unsigned),{key:privateKey,dsaEncoding:"ieee-p1363"});
  return`${unsigned}.${base64url(signature)}`;
}

async function sendApns(token:string,payload:ReturnType<typeof notificationPayload>):Promise<NativeSendResult>{
  const topic=process.env.APNS_BUNDLE_ID||"com.pindrizzle.app";
  const host=String(process.env.APNS_USE_SANDBOX||"").toLowerCase()==="true"?"https://api.sandbox.push.apple.com":"https://api.push.apple.com";
  try{
    const authorization=`bearer ${apnsJwt()}`;
    return await new Promise<NativeSendResult>((resolve)=>{
      const client=http2.connect(host);
      let settled=false;
      const finish=(value:NativeSendResult)=>{if(settled)return;settled=true;client.close();resolve(value);};
      client.on("error",error=>finish({ok:false,status:0,reason:error.message}));
      const request=client.request({":method":"POST",":path":`/3/device/${token}`,authorization,"apns-topic":topic,"apns-push-type":"alert","apns-priority":"10","content-type":"application/json"});
      let status=0;let body="";
      request.setEncoding("utf8");
      request.on("response",headers=>{status=Number(headers[":status"]||0);});
      request.on("data",chunk=>{body+=chunk;});
      request.on("end",()=>finish({ok:status>=200&&status<300,status,reason:status>=200&&status<300?"":body.slice(0,500)}));
      request.on("error",error=>finish({ok:false,status:0,reason:error.message}));
      request.end(JSON.stringify({aps:{alert:{title:payload.title,body:payload.body},sound:"default","thread-id":"pindrizzle"},notificationId:payload.notificationId,kind:payload.kind,pingId:payload.pingId||"",url:payload.url}));
    });
  }catch(error){return{ok:false,status:0,reason:error instanceof Error?error.message:"APNs delivery failed"};}
}

export async function POST(request:NextRequest){
  try{
    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!supabaseUrl||!serviceRoleKey)return NextResponse.json({error:"Push delivery is not configured."},{status:503});
    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const{data:configData,error:configError}=await admin.rpc("push_server_config");if(configError)throw configError;
    const config=((configData||[])[0]||null)as PushConfig|null;
    const suppliedSecret=request.headers.get("x-ping-push-secret")||"";
    if(!config?.webhook_secret||!suppliedSecret||!safeEqual(suppliedSecret,config.webhook_secret))return NextResponse.json({error:"Unauthorized."},{status:401});
    if(String(config.delivery_enabled).toLowerCase()!=="true")return NextResponse.json({ok:true,delivered:0,disabled:true},{status:202});

    const body=await request.json().catch(()=>null)as{notificationId?:string}|null;
    const notificationId=String(body?.notificationId||"");if(!isUuid(notificationId))return NextResponse.json({error:"Notification ID is invalid."},{status:400});
    const notificationResult=await admin.from("notifications").select("id,user_id,ping_id,kind,title,body").eq("id",notificationId).maybeSingle();if(notificationResult.error)throw notificationResult.error;
    const notification=notificationResult.data as NotificationRow|null;if(!notification)return NextResponse.json({ok:true,delivered:0,missing:true});
    const payload=notificationPayload(notification);

    const[subResult,nativeResult]=await Promise.all([
      admin.from("push_subscriptions").select("id,endpoint,p256dh,auth_secret").eq("user_id",notification.user_id).is("disabled_at",null).limit(5),
      admin.from("native_push_devices").select("id,platform,token").eq("user_id",notification.user_id).is("disabled_at",null).limit(5),
    ]);
    if(subResult.error)throw subResult.error;
    if(nativeResult.error)throw nativeResult.error;
    const subscriptions=(subResult.data||[])as SubscriptionRow[];
    const nativeDevices=(nativeResult.data||[])as NativeDeviceRow[];
    if(!subscriptions.length&&!nativeDevices.length)return NextResponse.json({ok:true,delivered:0});

    let delivered=0;let failed=0;let skipped=0;
    if(subscriptions.length&&config.vapid_public_key&&config.vapid_private_key&&config.vapid_subject){
      webpush.setVapidDetails(config.vapid_subject,config.vapid_public_key,config.vapid_private_key);
      const webPayload=JSON.stringify(payload);
      for(const subscription of subscriptions){
        const previous=await admin.from("push_delivery_attempts").select("attempt_count,delivered_at").eq("notification_id",notification.id).eq("subscription_id",subscription.id).maybeSingle();if(previous.error)throw previous.error;
        const attempt=previous.data as AttemptRow|null;if(attempt?.delivered_at)continue;
        await admin.from("push_delivery_attempts").upsert({notification_id:notification.id,subscription_id:subscription.id,attempt_count:(attempt?.attempt_count||0)+1,last_attempt_at:new Date().toISOString(),last_error:null},{onConflict:"notification_id,subscription_id"});
        try{
          await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_secret}},webPayload,{TTL:3600});delivered++;
          await admin.from("push_delivery_attempts").update({delivered_at:new Date().toISOString(),last_error:null}).eq("notification_id",notification.id).eq("subscription_id",subscription.id);
        }catch(sendError){failed++;const detail=sendError as{statusCode?:number;message?:string};const statusCode=Number(detail.statusCode||0);const message=String(detail.message||"Push delivery failed").slice(0,300);await admin.from("push_delivery_attempts").update({last_error:`${statusCode||"error"}: ${message}`}).eq("notification_id",notification.id).eq("subscription_id",subscription.id);if(statusCode===404||statusCode===410)await admin.from("push_subscriptions").update({disabled_at:new Date().toISOString()}).eq("id",subscription.id);}
      }
    }else skipped+=subscriptions.length;

    for(const device of nativeDevices){
      const previous=await admin.from("native_push_delivery_attempts").select("attempt_count,delivered_at").eq("notification_id",notification.id).eq("device_id",device.id).maybeSingle();if(previous.error)throw previous.error;
      const attempt=previous.data as AttemptRow|null;if(attempt?.delivered_at)continue;
      await admin.from("native_push_delivery_attempts").upsert({notification_id:notification.id,device_id:device.id,attempt_count:(attempt?.attempt_count||0)+1,last_attempt_at:new Date().toISOString(),last_error:null},{onConflict:"notification_id,device_id"});
      const configured=device.platform==="android"?Boolean(process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_CLIENT_EMAIL&&process.env.FIREBASE_PRIVATE_KEY):Boolean(process.env.APNS_KEY_ID&&process.env.APNS_TEAM_ID&&process.env.APNS_PRIVATE_KEY);
      if(!configured){skipped++;await admin.from("native_push_delivery_attempts").update({last_error:`${device.platform} credentials not configured`}).eq("notification_id",notification.id).eq("device_id",device.id);continue;}
      const result=device.platform==="android"?await sendFcm(device.token,payload):await sendApns(device.token,payload);
      if(result.ok){delivered++;await admin.from("native_push_delivery_attempts").update({delivered_at:new Date().toISOString(),last_error:null}).eq("notification_id",notification.id).eq("device_id",device.id);continue;}
      failed++;const reason=`${result.status||"error"}: ${result.reason}`.slice(0,500);await admin.from("native_push_delivery_attempts").update({last_error:reason}).eq("notification_id",notification.id).eq("device_id",device.id);
      const permanent=result.status===404||result.status===410||/UNREGISTERED|BadDeviceToken|Unregistered|NotRegistered/i.test(result.reason);if(permanent)await admin.from("native_push_devices").update({disabled_at:new Date().toISOString()}).eq("id",device.id);
    }

    return NextResponse.json({ok:true,delivered,failed,skipped});
  }catch(error){console.error("Push delivery failed",error);return NextResponse.json({error:"Push delivery failed."},{status:500});}
}
