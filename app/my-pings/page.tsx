"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/async-timeout";
import PingIcon from "@/components/PingIcon";
import EditOwnPingModal from "@/components/EditOwnPingModal";
import { CATEGORY_DEFINITIONS, type PingCategoryKey } from "@/lib/ping-categories";
import styles from "./my-pings.module.css";

type PingStatus = "active" | "resolved" | "expired" | "removed";
type MyPing = { id:string; title:string; body:string; category:PingCategoryKey; status:PingStatus; place_label:string|null; confirmation_count:number; comment_count:number; created_at:string; expires_at:string; updated_at:string; has_open_promotion:boolean; };
type LoadMode = "initial" | "refresh";

const tabs: Array<{ value:PingStatus; label:string }> = [
  { value:"active", label:"Active" }, { value:"resolved", label:"Resolved" }, { value:"expired", label:"Expired" }, { value:"removed", label:"Removed" },
];
const LOAD_TIMEOUT_MS = 10000;

function effectiveStatus(item: MyPing): PingStatus { return item.status === "active" && new Date(item.expires_at).getTime() <= Date.now() ? "expired" : item.status; }
function relativeTime(value:string) { const m=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000)); if(m<1)return"just now";if(m<60)return`${m} min ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;const d=Math.floor(h/24);return d<30?`${d}d ago`:new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short"}).format(new Date(value)); }
function expiryLabel(item:MyPing){const status=effectiveStatus(item);if(status==="expired")return`Expired ${relativeTime(item.expires_at)}`;if(status!=="active")return status==="resolved"?"Resolved":"Removed";const h=Math.max(1,Math.ceil((new Date(item.expires_at).getTime()-Date.now())/3600000));return h<24?`Expires in ${h}h`:`Expires in ${Math.ceil(h/24)}d`;}
function emptyCopy(status:PingStatus){if(status==="active")return"Pins you publish appear here.";if(status==="resolved")return"Resolved pins stay here for your records.";if(status==="expired")return"Expired pins stay here for your records.";return"Removed pins stay in your private history.";}
function errorText(value:unknown){if(value instanceof Error)return value.message;if(value&&typeof value==="object"&&"message" in value)return String((value as {message?:unknown}).message||"");return"";}

export default function MyPingsPage(){
  const [signedIn,setSignedIn]=useState<boolean|null>(null);
  const [items,setItems]=useState<MyPing[]>([]);
  const [selected,setSelected]=useState<PingStatus>("active");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [loadError,setLoadError]=useState("");
  const [busyId,setBusyId]=useState<string|null>(null);
  const [menuId,setMenuId]=useState<string|null>(null);
  const [editId,setEditId]=useState<string|null>(null);
  const [confirmRemoveId,setConfirmRemoveId]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const loadInFlightRef=useRef<Promise<void>|null>(null);

  const load=useCallback((mode:LoadMode="refresh")=>{
    if(loadInFlightRef.current)return loadInFlightRef.current;

    const run=(async()=>{
      if(mode==="initial") setLoading(true); else setRefreshing(true);
      setLoadError("");
      if(mode==="initial") setMessage("");
      try{
        const supabase=createClient();
        const {data:authData}=await withTimeout(supabase.auth.getSession(),LOAD_TIMEOUT_MS,"Session check timed out.");
        if(!authData.session?.user){setSignedIn(false);setItems([]);return;}
        setSignedIn(true);
        const {data,error}=await withTimeout(supabase.rpc("my_pings"),LOAD_TIMEOUT_MS,"My Pins request timed out.");
        if(error)throw error;
        setItems((data||[])as MyPing[]);
      }catch(error){
        console.error("My pins failed",error);
        setLoadError("Your pins are unavailable. Check your connection and try again.");
      }finally{
        setLoading(false);
        setRefreshing(false);
      }
    })();

    loadInFlightRef.current=run;
    void run.finally(()=>{if(loadInFlightRef.current===run)loadInFlightRef.current=null;});
    return run;
  },[]);

  useEffect(()=>{
    void load("initial");
    const supabase=createClient();
    const{data}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="INITIAL_SESSION"||event==="TOKEN_REFRESHED") return;
      if(!session?.user){setSignedIn(false);setItems([]);setLoading(false);setRefreshing(false);return;}
      window.setTimeout(()=>void load("refresh"),0);
    });
    const onFocus=()=>{if(document.visibilityState==="visible")void load("refresh");};
    document.addEventListener("visibilitychange",onFocus);
    return()=>{data.subscription.unsubscribe();document.removeEventListener("visibilitychange",onFocus);};
  },[load]);

  const normalized=useMemo(()=>items.map((item)=>({...item,status:effectiveStatus(item)})),[items]);
  const counts=useMemo(()=>normalized.reduce<Record<PingStatus,number>>((acc,item)=>{acc[item.status]+=1;return acc;},{active:0,resolved:0,expired:0,removed:0}),[normalized]);
  const visible=useMemo(()=>normalized.filter((item)=>item.status===selected),[normalized,selected]);

  const resolvePing=async(id:string)=>{setBusyId(id);setMessage("");try{const{error}=await createClient().rpc("resolve_own_ping",{target_ping_id:id});if(error)throw error;setItems((c)=>c.map((i)=>i.id===id?{...i,status:"resolved"}:i));setMenuId(null);setMessage("Pin resolved. It is no longer live.");}catch{setMessage("This pin could not be resolved.");}finally{setBusyId(null);}};
  const removePing=async(id:string)=>{setBusyId(id);setMessage("");try{const{error}=await createClient().rpc("remove_own_ping",{target_ping_id:id});if(error)throw error;setItems((c)=>c.map((i)=>i.id===id?{...i,status:"removed",has_open_promotion:false}:i));setConfirmRemoveId(null);setMenuId(null);setMessage("Pin removed. Its audit history is preserved.");}catch(error){const text=errorText(error).toLowerCase();setMessage(text.includes("promotion")?"This pin has an active promotion. End the promotion before removing it.":"This pin could not be removed.");}finally{setBusyId(null);}};
  const openAuth=()=>window.dispatchEvent(new CustomEvent("ping:auth-needed",{detail:{message:"Sign in to manage your pins."}}));
  const openPing=(id:string)=>window.dispatchEvent(new CustomEvent("ping:open-detail",{detail:{id,live:true}}));
  const openEdit=(id:string)=>{setMenuId(null);setEditId(id);};
  const savedEdit=async()=>{await load("refresh");setMessage("Pin updated.");};

  const errorState=loadError&&!loading&&items.length===0&&signedIn!==false;

  return <div className="page-shell"><div className="app-shell"><main className={`${styles.screen} my-pings-v3`}>
    <header className="my-pings-v3-header"><div className="brand small">Pindrizzle</div><h1>My Pins</h1><p>Manage the pins you’ve published.</p></header>
    {!loading&&signedIn===false?<section className={styles.empty}><span><PingIcon name="myPings" size={25}/></span><h2>Sign in to see your pins</h2><p>View, edit and resolve the pins you’ve published.</p><button type="button" onClick={openAuth}>Sign in / Sign up</button></section>:errorState?<section className={styles.empty}><span><PingIcon name="alert" size={25}/></span><h2>Your pins are unavailable</h2><p>{loadError}</p><button type="button" onClick={()=>void load("initial")}>Retry</button></section>:<>
      <div className={`${styles.tabs} my-pings-v3-tabs`} role="tablist" aria-label="My pin status">{tabs.map((tab)=><button type="button" key={tab.value} role="tab" aria-selected={selected===tab.value} className={selected===tab.value?styles.selectedTab:""} onClick={()=>setSelected(tab.value)}><span>{tab.label}</span><b>{counts[tab.value]}</b></button>)}</div>
      {loading?<section className={styles.empty}><h2>Loading your pins…</h2></section>:visible.length?<section className={`${styles.list} my-pings-v3-list`}>{visible.map((item)=>{const meta=CATEGORY_DEFINITIONS[item.category]||CATEGORY_DEFINITIONS.local;const menuOpen=menuId===item.id;const confirming=confirmRemoveId===item.id;return <article key={item.id} className={`${styles.card} ${styles[item.status]} my-pings-v3-card`}>
        <div className={styles.cardTop}><span className={styles.category}><i><PingIcon name={meta.icon} size={17}/></i>{meta.label}</span><span className={styles.status}>{item.status==="active"?"LIVE":item.status.toUpperCase()}</span></div>
        <h2>{item.title}</h2><p className={styles.body}>{item.body}</p>
        <div className={styles.meta}><span><PingIcon name="location" size={14}/>{item.place_label||"Approximate area"}</span><span><PingIcon name="confirmations" size={14}/>{item.confirmation_count}</span><span><PingIcon name="replies" size={14}/>{item.comment_count}</span></div>
        <div className={styles.timeRow}><span>Posted {relativeTime(item.created_at)}</span><span>{expiryLabel(item)}</span></div>
        {item.has_open_promotion&&<div className={styles.promotionNote}><PingIcon name="promote" size={14}/><span>Promotion in progress. Editing and removal are unavailable until it ends.</span></div>}
        <div className="my-pings-v3-actions">
          {item.status==="active"&&<button type="button" className="my-pings-v3-open" onClick={()=>openPing(item.id)}>Open</button>}
          {item.status==="active"&&<button type="button" className="my-pings-v3-edit" disabled={item.has_open_promotion||busyId===item.id} onClick={()=>openEdit(item.id)}><PingIcon name="edit" size={14}/>Edit</button>}
          {item.status!=="removed"&&<div className="my-pings-v3-menu-wrap"><button type="button" className="my-pings-v3-more" aria-label="More pin actions" onClick={()=>setMenuId(menuOpen?null:item.id)}><PingIcon name="more" size={18}/></button>{menuOpen&&<div className="my-pings-v3-menu">
            {item.status==="active"&&<button type="button" className="my-pings-v3-resolve-menu" disabled={busyId===item.id} onClick={()=>void resolvePing(item.id)}><PingIcon name="check" size={14}/>{busyId===item.id?"Working…":"Mark as resolved"}</button>}
            <button type="button" className="my-pings-v3-remove-menu" disabled={item.has_open_promotion||busyId===item.id} onClick={()=>setConfirmRemoveId(item.id)}><PingIcon name="remove" size={14}/>Remove pin</button>
            {item.has_open_promotion&&<small>Editing and removal are unavailable during promotion</small>}
          </div>}</div>}
        </div>
        {confirming&&!item.has_open_promotion&&<div className={styles.confirmRemove} role="alert"><div><strong>Remove this pin?</strong><p>This removes it from community views. Replies, reports and audit history are preserved.</p></div><div><button type="button" onClick={()=>setConfirmRemoveId(null)}>Keep</button><button type="button" onClick={()=>void removePing(item.id)} disabled={busyId===item.id}>{busyId===item.id?"Removing…":"Remove"}</button></div></div>}
      </article>;})}</section>:<section className={styles.empty}><span><PingIcon name={selected==="active"?"myPings":selected==="resolved"?"check":selected==="expired"?"clock":"remove"} size={25}/></span><h2>No {selected} pins</h2><p>{emptyCopy(selected)}</p>{selected==="active"&&<a href="/#ping">Drop a pin</a>}</section>}
    </>}
    {refreshing&&items.length>0&&<div className={styles.message} role="status">Refreshing…</div>}
    {loadError&&items.length>0&&<div className={styles.message} role="status">{loadError} <button type="button" onClick={()=>void load("refresh")}>Retry</button></div>}
    {message&&<div className={styles.message} role="status">{message}</div>}
  </main></div>
  {editId&&<EditOwnPingModal pingId={editId} onClose={()=>setEditId(null)} onSaved={savedEdit}/>} 
  <style jsx global>{`.my-pings-v3{padding-bottom:120px!important}.my-pings-v3-header{padding:25px 20px 14px}.my-pings-v3-header h1{margin:12px 0 4px;font-size:30px;letter-spacing:-1px}.my-pings-v3-header p{margin:0;color:var(--ping-muted);font-size:10.5px;line-height:1.45}.my-pings-v3-tabs{margin-top:4px!important}.my-pings-v3-card{border-radius:17px!important}.my-pings-v3-actions{display:flex;align-items:center;gap:7px;margin-top:11px}.my-pings-v3-actions>button{min-height:38px;border:1px solid var(--ping-line);border-radius:10px;background:#fff;color:var(--ping-ink-2);padding:0 14px;font-size:9px;font-weight:760}.my-pings-v3-open{background:var(--ping-ink)!important;color:#fff!important;border-color:var(--ping-ink)!important}.my-pings-v3-edit{display:flex;align-items:center;gap:6px}.my-pings-v3-edit:disabled{opacity:.45}.my-pings-v3-menu-wrap{position:relative;margin-left:auto}.my-pings-v3-more{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--ping-line);border-radius:10px;background:#fff;color:var(--ping-muted)}.my-pings-v3-menu{position:absolute;z-index:5;right:0;bottom:45px;width:190px;padding:7px;border:1px solid var(--ping-line);border-radius:12px;background:#fff;box-shadow:0 12px 30px rgba(16,25,18,.14)}.my-pings-v3-menu button{width:100%;min-height:40px;display:flex;align-items:center;gap:8px;border:0;border-radius:9px;background:transparent;padding:0 9px;text-align:left;font-size:9px;font-weight:750}.my-pings-v3-menu button:hover{background:var(--ping-surface-soft)}.my-pings-v3-resolve-menu{color:var(--ping-ink-2)}.my-pings-v3-remove-menu{color:var(--ping-danger)}.my-pings-v3-menu button:disabled{opacity:.45}.my-pings-v3-menu small{display:block;padding:3px 9px 6px;color:var(--ping-muted);font-size:7.5px}`}</style></div>;
}
