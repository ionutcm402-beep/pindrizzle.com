"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LivePingMap, { type MapPing } from "@/components/LivePingMap";
import PingIcon from "@/components/PingIcon";
import {
  CATEGORY_DEFINITIONS,
  CATEGORY_ORDER,
  DEAL_KIND_LABEL,
  DEAL_SOURCE_LABEL,
  MARKETPLACE_INTENT_LABEL,
  MARKETPLACE_INTENTS,
  MARKETPLACE_TYPE_LABEL,
  MARKETPLACE_TYPES,
  formatMarketplacePrice,
  marketplaceSubtypeLabel,
  type DealKind,
  type DealSource,
  type MarketplaceIntent,
  type MarketplacePricePeriod,
  type MarketplaceSubtype,
  type MarketplaceType,
  type PingCategoryKey,
  type Radius,
} from "@/lib/ping-categories";
import {
  readMarketplaceIntent,
  readMarketplaceMaxPrice,
  readMarketplaceType,
  readPingCategory,
  readPingRadius,
  subscribePingLocalPreferences,
  writeMarketplaceIntent,
  writeMarketplaceMaxPrice,
  writeMarketplaceType,
  writePingCategory,
  writePingRadius,
  type MarketplaceIntentFilter,
  type MarketplaceTypeFilter,
  type PingLocalFilter,
} from "@/lib/ping-local-preferences";
import { createClient } from "@/lib/supabase/client";
import { getPingLocationSilently, requestPingLocation, type PingCoordinates, type PingLocationState } from "@/lib/ping-location";
import { NEARBY_PLACE_CATEGORIES, type NearbyPlace, type NearbyPlaceCategory } from "@/lib/nearby-places";

type MapRow = { id:string; category:PingCategoryKey; title:string; confirmation_count:number; distance_meters:number; map_lat:number; map_lng:number; };
type MetaRow = {
  id:string;
  last_confirmed_at:string|null;
  deal_source:DealSource|null;
  deal_kind:DealKind|null;
  merchant_name:string|null;
  marketplace_type:MarketplaceType|null;
  marketplace_intent:MarketplaceIntent|null;
  marketplace_subtype:MarketplaceSubtype|null;
  marketplace_price:number|string|null;
  marketplace_price_period:MarketplacePricePeriod|null;
  marketplace_currency:string|null;
  marketplace_url:string|null;
};
type EnrichedMapPing = MapPing & {
  lastConfirmedAt?:string|null;
  dealSource?:DealSource|null;
  dealKind?:DealKind|null;
  merchantName?:string|null;
  marketplaceType?:MarketplaceType|null;
  marketplaceIntent?:MarketplaceIntent|null;
  marketplaceSubtype?:MarketplaceSubtype|null;
  marketplacePrice?:number|null;
  marketplacePricePeriod?:MarketplacePricePeriod|null;
  marketplaceCurrency?:string|null;
  marketplaceUrl?:string|null;
};

const RADII: Radius[] = [0.5,1,3,5];
const MARKETPLACE_PRICE_FILTERS = [500,1000,2000,5000,10000,25000,50000,100000,250000,500000,1000000];
const PLACES_CACHE_TTL_MS = 10*60*1000;

type PlaceVisibility = Record<NearbyPlaceCategory, boolean>;
type StoredPlaces = { savedAt:number; places:NearbyPlace[] };

function defaultPlaceVisibility():PlaceVisibility{return{toilets:true,restaurant:true,park:true,playground:true};}
function placeCategoryLabel(category:NearbyPlaceCategory){return NEARBY_PLACE_CATEGORIES.find((item)=>item.key===category)?.label||"Nearby place";}
function placeDistance(meters:number){const miles=meters/1609.344;return miles<0.1?`${Math.max(1,Math.round(meters))} m away`:`${miles.toFixed(1)} mi away`;}

function freshness(value?:string|null){if(!value)return"";const minutes=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));if(minutes<1)return"confirmed just now";if(minutes<60)return`last confirmed ${minutes} min ago`;const hours=Math.floor(minutes/60);return hours<24?`last confirmed ${hours}h ago`:`last confirmed ${Math.floor(hours/24)}d ago`;}

export default function MapHome(){
  const[center,setCenter]=useState<PingCoordinates|null>(null);
  const[locationState,setLocationState]=useState<PingLocationState>("checking");
  const[radius,setRadius]=useState<Radius>(1);
  const[filter,setFilter]=useState<PingLocalFilter>("all");
  const[marketplaceTypeFilter,setMarketplaceTypeFilter]=useState<MarketplaceTypeFilter>("all");
  const[marketplaceIntentFilter,setMarketplaceIntentFilter]=useState<MarketplaceIntentFilter>("all");
  const[marketplaceMaxPrice,setMarketplaceMaxPrice]=useState<number|null>(null);
  const[filterOpen,setFilterOpen]=useState(false);
  const[allPings,setAllPings]=useState<EnrichedMapPing[]>([]);
  const[selectedId,setSelectedId]=useState<string|null>(null);
  const[status,setStatus]=useState("Checking location…");
  const[dataBusy,setDataBusy]=useState(false);
  const[refreshKey,setRefreshKey]=useState(0);
  const[allPlaces,setAllPlaces]=useState<NearbyPlace[]>([]);
  const[placeVisibility,setPlaceVisibility]=useState<PlaceVisibility>(defaultPlaceVisibility);
  const[selectedPlaceId,setSelectedPlaceId]=useState<string|null>(null);
  const[placesBusy,setPlacesBusy]=useState(false);
  const[placesMessage,setPlacesMessage]=useState("");

  useEffect(()=>{
    setRadius(readPingRadius());setFilter(readPingCategory());setMarketplaceTypeFilter(readMarketplaceType());setMarketplaceIntentFilter(readMarketplaceIntent());setMarketplaceMaxPrice(readMarketplaceMaxPrice());
    const unsubscribe=subscribePingLocalPreferences((next)=>{setRadius(next.radius);setFilter(next.category);setMarketplaceTypeFilter(next.marketplaceType);setMarketplaceIntentFilter(next.marketplaceIntent);setMarketplaceMaxPrice(next.marketplaceMaxPrice);});
    let cancelled=false;
    void getPingLocationSilently().then((result)=>{if(cancelled)return;setLocationState(result.state);if(result.coordinates)setCenter(result.coordinates);else setStatus(result.state==="denied"?"Location is off.":"Turn on location to explore nearby pins.");});
    const handleLocation=(event:Event)=>{const detail=(event as CustomEvent<PingCoordinates>).detail;if(!detail)return;setCenter(detail);setLocationState("granted");setRefreshKey((value)=>value+1);};
    window.addEventListener("ping:location-changed",handleLocation);return()=>{cancelled=true;unsubscribe();window.removeEventListener("ping:location-changed",handleLocation);};
  },[]);

  const requestLocation=useCallback(async()=>{setLocationState("requesting");setStatus("Finding your location…");const result=await requestPingLocation();setLocationState(result.state);if(result.coordinates){setCenter(result.coordinates);setRefreshKey((value)=>value+1);}else if(result.state==="denied")setStatus("Allow location in your browser settings, then try again.");else setStatus("Location is unavailable.");},[]);

  useEffect(()=>{
    if(!center)return;let cancelled=false;
    const load=async()=>{setDataBusy(true);setStatus("Loading nearby pins…");try{
      const supabase=createClient();const{data,error}=await supabase.rpc("nearby_map_pings",{viewer_lat:center.lat,viewer_lng:center.lng,radius_meters:Math.round(radius*1609.344),result_limit:100});if(error)throw error;
      const rows=(data||[])as MapRow[];
      const metaResult=rows.length?await supabase.from("pings").select("id,last_confirmed_at,deal_source,deal_kind,merchant_name,marketplace_type,marketplace_intent,marketplace_subtype,marketplace_price,marketplace_price_period,marketplace_currency,marketplace_url").in("id",rows.map((row)=>row.id)):{data:[],error:null};
      const metaMap=new Map<string,MetaRow>();(metaResult.data||[]).forEach((row)=>metaMap.set(String(row.id),row as MetaRow));if(cancelled)return;
      const mapped:EnrichedMapPing[]=rows.map((row)=>{const extra=metaMap.get(row.id);const numericPrice=extra?.marketplace_price==null?null:Number(extra.marketplace_price);return{id:row.id,lat:row.map_lat,lng:row.map_lng,title:row.title,categoryKey:row.category,category:CATEGORY_DEFINITIONS[row.category].label,distanceMiles:row.distance_meters/1609.344,confirmations:row.confirmation_count,lastConfirmedAt:extra?.last_confirmed_at,dealSource:extra?.deal_source,dealKind:extra?.deal_kind,merchantName:extra?.merchant_name,marketplaceType:extra?.marketplace_type,marketplaceIntent:extra?.marketplace_intent,marketplaceSubtype:extra?.marketplace_subtype,marketplacePrice:numericPrice!=null&&Number.isFinite(numericPrice)?numericPrice:null,marketplacePricePeriod:extra?.marketplace_price_period,marketplaceCurrency:extra?.marketplace_currency,marketplaceUrl:extra?.marketplace_url,priceLabel:row.category==="marketplace"&&numericPrice!=null&&Number.isFinite(numericPrice)?formatMarketplacePrice(numericPrice,extra?.marketplace_price_period,extra?.marketplace_currency||"GBP",true):null};});
      setAllPings(mapped);setStatus(mapped.length?`${mapped.length} live nearby`:`Quiet within ${radius} mi`);
    }catch(error){console.error("Map query failed",error);if(!cancelled){setAllPings([]);setSelectedId(null);setStatus("Nearby pins are unavailable.");}}finally{if(!cancelled)setDataBusy(false);}};
    void load();return()=>{cancelled=true;};
  },[center,radius,refreshKey]);

  useEffect(()=>{
    if(!center)return;
    const controller=new AbortController();
    let cancelled=false;
    const roundedLat=center.lat.toFixed(3);const roundedLng=center.lng.toFixed(3);const radiusMeters=Math.round(radius*1609.344);
    const cacheKey=`pindrizzle:nearby-places:v1:${roundedLat}:${roundedLng}:${radiusMeters}`;
    const load=async()=>{
      setPlacesBusy(true);setPlacesMessage("");
      try{
        let cached:StoredPlaces|null=null;
        try{const raw=sessionStorage.getItem(cacheKey);if(raw)cached=JSON.parse(raw)as StoredPlaces;}catch{}
        if(cached&&Date.now()-cached.savedAt<PLACES_CACHE_TTL_MS){setAllPlaces(cached.places);setPlacesMessage(`${cached.places.length} public places`);return;}
        const response=await fetch(`/api/places/nearby?lat=${encodeURIComponent(roundedLat)}&lng=${encodeURIComponent(roundedLng)}&radius=${radiusMeters}`,{signal:controller.signal});
        const payload=await response.json().catch(()=>({}))as{places?:NearbyPlace[];error?:string};
        if(!response.ok)throw new Error(payload.error||"Nearby places could not load.");
        if(cancelled)return;
        const places=Array.isArray(payload.places)?payload.places:[];setAllPlaces(places);setPlacesMessage(places.length?`${places.length} public places`:"No mapped public places nearby");
        try{sessionStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),places} satisfies StoredPlaces));}catch{}
      }catch(error){if(cancelled||controller.signal.aborted)return;console.error("Nearby places load failed",error);setAllPlaces([]);setPlacesMessage("Public places unavailable");}
      finally{if(!cancelled)setPlacesBusy(false);}
    };
    void load();return()=>{cancelled=true;controller.abort();};
  },[center,radius]);

  useEffect(()=>{if(!center)return;const supabase=createClient();let timer:ReturnType<typeof setTimeout>|null=null;const refresh=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>setRefreshKey((value)=>value+1),300);};const pingsChannel=supabase.channel("ping-map-live-v4").on("postgres_changes",{event:"*",schema:"public",table:"pings"},refresh).subscribe();const confirmsChannel=supabase.channel("ping-map-confirms-v4").on("postgres_changes",{event:"*",schema:"public",table:"confirmations"},refresh).subscribe();return()=>{if(timer)clearTimeout(timer);void supabase.removeChannel(pingsChannel);void supabase.removeChannel(confirmsChannel);};},[center]);

  const pings=useMemo(()=>{const base=filter==="all"?allPings:allPings.filter((ping)=>ping.categoryKey===filter);if(filter!=="marketplace")return base;return base.filter((ping)=>(marketplaceTypeFilter==="all"||ping.marketplaceType===marketplaceTypeFilter)&&(marketplaceIntentFilter==="all"||ping.marketplaceIntent===marketplaceIntentFilter)&&(marketplaceMaxPrice==null||(ping.marketplacePrice!=null&&ping.marketplacePrice<=marketplaceMaxPrice)));},[allPings,filter,marketplaceTypeFilter,marketplaceIntentFilter,marketplaceMaxPrice]);
  const places=useMemo(()=>allPlaces.filter((place)=>placeVisibility[place.category]),[allPlaces,placeVisibility]);

  useEffect(()=>{setSelectedId((current)=>current&&pings.some((ping)=>ping.id===current)?current:pings[0]?.id||null);},[pings]);
  const selectedIndex=useMemo(()=>Math.max(0,pings.findIndex((ping)=>ping.id===selectedId)),[pings,selectedId]);
  const selected=pings[selectedIndex]||null;const selectedDefinition=selected?CATEGORY_DEFINITIONS[selected.categoryKey]:null;
  const selectedPlace=useMemo(()=>places.find((place)=>place.id===selectedPlaceId)||null,[places,selectedPlaceId]);
  useEffect(()=>{if(selectedPlaceId&&!selectedPlace)setSelectedPlaceId(null);},[selectedPlace,selectedPlaceId]);
  const stepSelected=(direction:-1|1)=>{if(!pings.length)return;const next=(selectedIndex+direction+pings.length)%pings.length;setSelectedId(pings[next].id);};
  const openSelected=()=>{if(!selected)return;window.dispatchEvent(new CustomEvent("ping:open-detail",{detail:{...selected,live:true}}));};
  const selectPing=useCallback((id:string)=>{setSelectedPlaceId(null);setSelectedId(id);},[]);
  const selectPlace=useCallback((id:string)=>{setSelectedId(null);setSelectedPlaceId(id);},[]);
  const togglePlace=useCallback((category:NearbyPlaceCategory)=>{setPlaceVisibility((current)=>({...current,[category]:!current[category]}));},[]);
  const needsLocation=!center&&locationState!=="checking"&&locationState!=="requesting";
  const displayStatus=!dataBusy&&center?(pings.length?`${pings.length} matching nearby`:`Quiet within ${radius} mi`):status;

  return <div className="page-shell"><div className="app-shell"><main className="map-v3-screen launch-map-screen">
    {center?<LivePingMap center={center} radiusMiles={radius} pings={pings} selectedId={selectedId} onSelect={selectPing} places={places} selectedPlaceId={selectedPlaceId} onSelectPlace={selectPlace}/>:<section className="map-v3-location"><span><PingIcon name="location" size={27}/></span><h1>See what’s nearby</h1><p>{status}</p><small>Location powers the nearby map. Your exact browser position is not published.</small>{needsLocation&&<button type="button" onClick={()=>void requestLocation()}>Enable location</button>}{(locationState==="checking"||locationState==="requesting")&&<div className="map-v3-checking">Checking location…</div>}</section>}
    <header className="map-v3-topbar"><div className="map-v3-brand"><div className="brand small">Pindrizzle</div><strong>Map</strong></div><div className="map-v3-top-actions">{center&&<button type="button" onClick={()=>void requestLocation()} aria-label="Recenter on my location"><PingIcon name="location" size={17}/></button>}{center&&<button type="button" onClick={()=>setRefreshKey((value)=>value+1)} disabled={dataBusy} aria-label="Refresh nearby pins">↻</button>}</div></header>
    {center&&<section className="map-v3-controls" aria-label="Map controls"><div className="map-v3-status"><span className={dataBusy||placesBusy?"busy":""}/><strong>{displayStatus} · {placesBusy?"Loading public places…":placesMessage}</strong></div><div className="map-v3-control-row"><div className="map-v3-radii" aria-label="Nearby radius">{RADII.map((option)=><button type="button" key={option} className={radius===option?"active":""} onClick={()=>{writePingRadius(option);setSelectedId(null);setSelectedPlaceId(null);}} aria-label={`${option} ${option===1?"mile":"miles"}`}>{option} mi</button>)}</div><button type="button" className="map-v3-filter-button" onClick={()=>setFilterOpen(true)} aria-label="Open detailed filters"><span>Filters</span><PingIcon name="more" size={17}/></button></div><div className="map-v3-category-chips" aria-label="Map categories"><button type="button" className={filter==="all"?"active":""} onClick={()=>writePingCategory("all")}>All pins</button>{CATEGORY_ORDER.map((key)=>{const item=CATEGORY_DEFINITIONS[key];return <button type="button" key={key} className={filter===key?"active":""} onClick={()=>{writePingCategory(key);if(key==="marketplace"&&filter==="marketplace")setFilterOpen(true);}}><PingIcon name={item.icon} size={12}/>{item.shortLabel}</button>;})}<span className="map-v3-chip-divider" aria-hidden="true"/>{NEARBY_PLACE_CATEGORIES.map((item)=><button type="button" key={item.key} className={`map-v3-place-chip map-v3-place-chip-${item.key}${placeVisibility[item.key]?" active":""}`} aria-pressed={placeVisibility[item.key]} onClick={()=>togglePlace(item.key)}>{item.shortLabel}</button>)}</div></section>}
    {center&&!dataBusy&&pings.length===0&&<section className="map-v3-quiet"><strong>No active pins</strong><span>{filter==="marketplace"?"No Marketplace listings match these filters.":`No ${filter==="all"?"active pins":CATEGORY_DEFINITIONS[filter].label+" pins"} within ${radius} mi.`}</span><button type="button" onClick={()=>writePingCategory("all")}>Show all categories</button></section>}
    {selected&&selectedDefinition&&<section className="map-v3-card" aria-label="Selected pin"><button type="button" className="map-v3-card-main" onClick={openSelected}><div className="map-v3-card-top"><span><i><PingIcon name={selectedDefinition.icon} size={15}/></i>{selectedDefinition.label}</span><b>{selected.distanceMiles.toFixed(1)} mi away</b></div>{selected.categoryKey==="deals"&&selected.merchantName&&<div className="map-v3-merchant"><PingIcon name={selected.dealSource==="business"?"business":"deals"} size={13}/><strong>{selected.merchantName}</strong>{selected.dealSource&&<span>{DEAL_SOURCE_LABEL[selected.dealSource]}</span>}{selected.dealKind&&<span>· {DEAL_KIND_LABEL[selected.dealKind]}</span>}</div>}{selected.categoryKey==="marketplace"&&selected.marketplaceType&&selected.marketplaceIntent&&<div className="map-v3-market"><div><PingIcon name={selected.marketplaceType==="property"?"property":selected.marketplaceType==="vehicle"?"vehicle":"parking"} size={13}/><strong>{marketplaceSubtypeLabel(selected.marketplaceType,selected.marketplaceSubtype)}</strong><span>{MARKETPLACE_INTENT_LABEL[selected.marketplaceIntent]}</span></div><b>{formatMarketplacePrice(selected.marketplacePrice,selected.marketplacePricePeriod,selected.marketplaceCurrency||"GBP")}</b></div>}<h2>{selected.title}</h2><footer><span><PingIcon name="confirmations" size={14}/>{selected.confirmations} confirmed{selected.lastConfirmedAt?` · ${freshness(selected.lastConfirmedAt)}`:""}</span><strong>Open →</strong></footer></button>{pings.length>1&&<div className="map-v3-card-pager"><button type="button" onClick={()=>stepSelected(-1)} aria-label="Previous nearby pin">‹</button><span>{selectedIndex+1} of {pings.length}</span><button type="button" onClick={()=>stepSelected(1)} aria-label="Next nearby pin">›</button></div>}</section>}
    {selectedPlace&&<section className={`map-v3-place-card map-v3-place-card-${selectedPlace.category}`} aria-label="Nearby place information"><span className="map-v3-place-card-icon" aria-hidden="true"/><div><small>{placeCategoryLabel(selectedPlace.category)}</small><h2>{selectedPlace.name}</h2><p>{placeDistance(selectedPlace.distanceMeters)}</p><a href={`https://www.openstreetmap.org/${selectedPlace.osmType}/${selectedPlace.osmId}`} target="_blank" rel="noopener noreferrer">OpenStreetMap details</a></div><button type="button" onClick={()=>setSelectedPlaceId(null)} aria-label="Close nearby place information">×</button><footer>Public place data © OpenStreetMap contributors</footer></section>}
  </main></div>

  {filterOpen&&<div className="map-v3-filter-backdrop" role="dialog" aria-modal="true" aria-label="Map filters" onClick={()=>setFilterOpen(false)}><section className="map-v3-filter-sheet" onClick={(event)=>event.stopPropagation()}><div className="sheet-handle"/><div className="map-v3-filter-head"><div><span>MAP FILTERS</span><h2>Choose what to show</h2></div><button type="button" onClick={()=>setFilterOpen(false)}>Done</button></div><h3 className="map-v3-filter-section-title">Community pins</h3><div className="map-v3-filter-grid"><button type="button" className={filter==="all"?"active":""} onClick={()=>writePingCategory("all")}>All categories</button>{CATEGORY_ORDER.map((key)=>{const item=CATEGORY_DEFINITIONS[key];return<button type="button" key={key} className={filter===key?"active":""} onClick={()=>writePingCategory(key)}><PingIcon name={item.icon} size={16}/>{item.label}</button>;})}</div>{filter==="marketplace"&&<section className="map-v3-market-filters"><div><strong>Marketplace</strong><span>These preferences are shared with the Feed.</span></div><label>Type<select value={marketplaceTypeFilter} onChange={(event)=>writeMarketplaceType(event.target.value as MarketplaceTypeFilter)}><option value="all">Everything</option>{MARKETPLACE_TYPES.map((value)=><option key={value} value={value}>{MARKETPLACE_TYPE_LABEL[value]}</option>)}</select></label><label>Looking for<select value={marketplaceIntentFilter} onChange={(event)=>writeMarketplaceIntent(event.target.value as MarketplaceIntentFilter)}><option value="all">Sale, rent or wanted</option>{MARKETPLACE_INTENTS.map((value)=><option key={value} value={value}>{MARKETPLACE_INTENT_LABEL[value]}</option>)}</select></label><label>Maximum price<select value={marketplaceMaxPrice??""} onChange={(event)=>writeMarketplaceMaxPrice(event.target.value?Number(event.target.value):null)}><option value="">Any price</option>{MARKETPLACE_PRICE_FILTERS.map((price)=><option key={price} value={price}>Up to {formatMarketplacePrice(price,"total")}</option>)}</select></label></section>}<h3 className="map-v3-filter-section-title places">Nearby public places</h3><div className="map-v3-place-filter-grid">{NEARBY_PLACE_CATEGORIES.map((item)=><button type="button" key={item.key} className={`place-${item.key}${placeVisibility[item.key]?" active":""}`} aria-pressed={placeVisibility[item.key]} onClick={()=>togglePlace(item.key)}><span aria-hidden="true"/>{item.label}<b>{placeVisibility[item.key]?"Shown":"Hidden"}</b></button>)}</div><p className="map-v3-osm-note">Place data comes from OpenStreetMap and is cached for 10 minutes.</p></section></div>}

  <style jsx global>{`
    .map-v3-screen{position:absolute;inset:0 0 82px;overflow:hidden;background:#e8ece6}.map-v3-screen .live-ping-map{position:absolute;inset:0}.map-v3-location{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;padding:34px;text-align:center;color:var(--ping-ink)}.map-v3-location>span{width:58px;height:58px;display:grid;place-items:center;border-radius:17px;background:#fff;color:var(--ping-blue);border:1px solid var(--ping-line)}.map-v3-location h1{margin:15px 0 6px;font-size:25px;letter-spacing:-.8px}.map-v3-location p{margin:0;color:var(--ping-ink-2);font-size:12px}.map-v3-location small{max-width:320px;margin-top:8px;color:var(--ping-muted);font-size:10px;line-height:1.5}.map-v3-location button{margin-top:17px;min-height:40px;border:0;border-radius:12px;background:var(--ping-ink);color:#fff;padding:0 16px;font-size:10px;font-weight:780}.map-v3-checking{margin-top:15px;color:var(--ping-muted);font-size:10px;font-weight:700}
    .map-v3-topbar{position:absolute;z-index:8;top:14px;left:14px;right:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;pointer-events:none}.map-v3-topbar>div{pointer-events:auto}.map-v3-brand{display:flex;align-items:baseline;gap:8px;padding:7px 11px;border:1px solid var(--ping-line);border-radius:13px;background:rgba(255,255,255,.95);box-shadow:0 8px 22px rgba(16,25,18,.08)}.map-v3-brand>strong{font-size:10px;color:var(--ping-muted)}.map-v3-top-actions{display:flex;gap:7px}.map-v3-top-actions button{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--ping-line);border-radius:13px;background:rgba(255,255,255,.95);color:var(--ping-ink-2);font-size:17px;box-shadow:0 8px 22px rgba(16,25,18,.08)}
    .map-v3-controls{position:absolute;z-index:7;top:70px;left:14px;right:14px;padding:10px;border:1px solid rgba(16,19,17,.08);border-radius:15px;background:rgba(255,255,255,.94);box-shadow:0 9px 26px rgba(16,25,18,.08);backdrop-filter:blur(14px)}.map-v3-status{display:flex;align-items:center;gap:7px;color:var(--ping-ink-2);font-size:9px}.map-v3-status>span{width:7px;height:7px;border-radius:50%;background:var(--ping-accent)}.map-v3-status>span.busy{animation:mapV3Pulse 1s infinite}.map-v3-status strong{flex:1}.map-v3-control-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:8px}.map-v3-radii{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.map-v3-radii button{height:31px;border:0;border-radius:9px;background:var(--ping-surface-soft);color:var(--ping-muted);font-size:9px;font-weight:750}.map-v3-radii button.active{background:var(--ping-ink);color:#fff}.map-v3-filter-button{height:31px;max-width:130px;display:flex;align-items:center;gap:5px;border:1px solid var(--ping-line);border-radius:9px;background:#fff;color:var(--ping-ink-2);padding:0 9px;font-size:8.5px;font-weight:720}.map-v3-filter-button span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.map-v3-category-chips{display:flex;gap:5px;overflow-x:auto;margin-top:6px;padding:1px 0 2px;scrollbar-width:none;overscroll-behavior-x:contain}.map-v3-category-chips::-webkit-scrollbar{display:none}.map-v3-category-chips button{flex:0 0 auto;height:25px;display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(8,43,73,.08);border-radius:999px;background:rgba(235,243,246,.88);color:#496777;padding:0 8px;font-size:7px;font-weight:760;white-space:nowrap}.map-v3-category-chips button.active{border-color:#082b49;background:#082b49;color:#fff}.map-v3-category-chips button svg{width:11px;height:11px}.map-v3-chip-divider{flex:0 0 1px;width:1px;height:19px;align-self:center;background:rgba(8,43,73,.14)}.map-v3-category-chips .map-v3-place-chip{position:relative;padding-left:19px}.map-v3-category-chips .map-v3-place-chip::before{content:"";position:absolute;left:7px;width:7px;height:7px;border-radius:3px;background:#27865e}.map-v3-category-chips .map-v3-place-chip-toilets::before{background:#6b5fc7}.map-v3-category-chips .map-v3-place-chip-restaurant::before{background:#df715b}.map-v3-category-chips .map-v3-place-chip-playground::before{background:#d59a2d}.map-v3-category-chips .map-v3-place-chip:not(.active){opacity:.48;text-decoration:line-through}.map-v3-category-chips .map-v3-place-chip.active{border-color:rgba(8,43,73,.14);background:#fff;color:#183d52}
    .map-v3-quiet{position:absolute;z-index:6;left:14px;right:14px;bottom:88px;padding:13px 14px;border:1px solid var(--ping-line);border-radius:15px;background:rgba(255,255,255,.96);box-shadow:0 10px 26px rgba(16,25,18,.09);display:grid;gap:4px}.map-v3-quiet strong{font-size:12px}.map-v3-quiet span{color:var(--ping-muted);font-size:9px}.map-v3-quiet button{justify-self:start;margin-top:5px;border:0;background:transparent;color:var(--ping-accent-ink);padding:0;font-size:9px;font-weight:760}
    .map-v3-card{position:absolute;z-index:7;left:14px;right:14px;bottom:88px;border:1px solid var(--ping-line);border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 13px 34px rgba(16,25,18,.12);overflow:hidden}.map-v3-card-main{width:100%;padding:12px 13px;border:0;background:transparent;color:var(--ping-ink);text-align:left}.map-v3-card-top,.map-v3-card-main footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.map-v3-card-top>span{display:inline-flex;align-items:center;gap:7px;color:var(--ping-ink-2);font-size:9px;font-weight:750}.map-v3-card-top i{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;background:var(--ping-surface-soft);font-style:normal}.map-v3-card-top>b{color:var(--ping-muted);font-size:8.5px}.map-v3-merchant{display:flex;align-items:center;gap:5px;margin-top:8px;color:#79621e;font-size:8px}.map-v3-merchant strong{color:#40350f}.map-v3-market{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:8px 9px;border-radius:10px;background:var(--ping-surface-soft)}.map-v3-market>div{display:flex;align-items:center;gap:5px;flex-wrap:wrap;color:var(--ping-muted);font-size:8px}.map-v3-market strong{color:var(--ping-ink-2)}.map-v3-market>b{font-size:13px;color:var(--ping-ink);white-space:nowrap}.map-v3-card h2{margin:8px 0 9px;font-size:15px;line-height:1.2;letter-spacing:-.3px}.map-v3-card-main footer{color:var(--ping-muted);font-size:8px}.map-v3-card-main footer>span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.map-v3-card-main footer strong{color:var(--ping-accent-ink);font-size:9px}.map-v3-card-pager{height:32px;display:grid;grid-template-columns:32px 1fr 32px;align-items:center;border-top:1px solid var(--ping-line);background:var(--ping-surface-soft)}.map-v3-card-pager button{height:32px;border:0;background:transparent;color:var(--ping-ink-2);font-size:19px}.map-v3-card-pager span{text-align:center;color:var(--ping-muted);font-size:8px;font-weight:720}
    .map-v3-place-card{--place:#27865e;position:absolute;z-index:9;left:14px;right:14px;bottom:18px;display:grid;grid-template-columns:38px 1fr 32px;gap:10px;align-items:start;padding:13px 13px 10px;border:1px solid rgba(8,43,73,.1);border-radius:18px;background:rgba(255,255,255,.97);box-shadow:0 14px 38px rgba(8,43,73,.16);backdrop-filter:blur(18px)}.map-v3-place-card-toilets{--place:#6b5fc7}.map-v3-place-card-restaurant{--place:#df715b}.map-v3-place-card-playground{--place:#d59a2d}.map-v3-place-card-icon{width:38px;height:38px;border-radius:11px;background:var(--place)}.map-v3-place-card small{display:block;color:var(--place);font-size:8px;font-weight:820;text-transform:uppercase;letter-spacing:.06em}.map-v3-place-card h2{margin:3px 0;font-size:15px;line-height:1.2}.map-v3-place-card p{margin:0;color:var(--ping-muted);font-size:9px}.map-v3-place-card a{display:inline-block;margin-top:6px;color:#0d6c8c;font-size:8px;font-weight:760;text-decoration:none}.map-v3-place-card>button{width:32px;height:32px;border:0;border-radius:9px;background:var(--ping-surface-soft);color:var(--ping-muted);font-size:18px}.map-v3-place-card footer{grid-column:1/-1;padding-top:7px;border-top:1px solid rgba(8,43,73,.07);color:var(--ping-muted-2);font-size:7px}
    .map-v3-filter-backdrop{position:fixed;inset:0;z-index:180;background:rgba(11,15,12,.28);display:flex;align-items:flex-end;justify-content:center}.map-v3-filter-sheet{width:min(100%,480px);max-height:82dvh;overflow:auto;border-radius:24px 24px 0 0;background:var(--ping-canvas);padding:10px 18px max(24px,env(safe-area-inset-bottom));box-shadow:0 -18px 50px rgba(16,19,17,.18)}.map-v3-filter-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:8px 0 14px}.map-v3-filter-head span{font-size:8px;font-weight:800;letter-spacing:.1em;color:var(--ping-muted-2)}.map-v3-filter-head h2{margin:4px 0 0;font-size:20px;letter-spacing:-.5px}.map-v3-filter-head button{border:0;background:transparent;color:var(--ping-accent-ink);font-size:10px;font-weight:800}.map-v3-filter-section-title{margin:14px 0 8px;color:var(--ping-muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.map-v3-filter-section-title.places{margin-top:18px}.map-v3-filter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.map-v3-filter-grid button{min-height:44px;display:flex;align-items:center;justify-content:flex-start;gap:8px;border:1px solid var(--ping-line);border-radius:12px;background:#fff;color:var(--ping-ink-2);padding:0 11px;font-size:9px;font-weight:720}.map-v3-filter-grid button.active{border-color:var(--ping-ink);background:var(--ping-ink);color:#fff}.map-v3-market-filters{margin-top:14px;padding:12px;border:1px solid var(--ping-line);border-radius:14px;background:#fff;display:grid;grid-template-columns:1fr 1fr;gap:8px}.map-v3-market-filters>div{grid-column:1/-1}.map-v3-market-filters>div strong,.map-v3-market-filters>div span{display:block}.map-v3-market-filters>div strong{font-size:11px}.map-v3-market-filters>div span{margin-top:2px;color:var(--ping-muted);font-size:8px}.map-v3-market-filters label{display:grid;gap:5px;color:var(--ping-muted);font-size:8px;font-weight:750}.map-v3-market-filters label:last-child{grid-column:1/-1}.map-v3-market-filters select{height:38px;min-width:0;border:1px solid var(--ping-line);border-radius:10px;background:var(--ping-surface-soft);padding:0 8px;color:var(--ping-ink-2);font-size:9px}.map-v3-place-filter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.map-v3-place-filter-grid button{min-height:46px;display:grid;grid-template-columns:12px 1fr auto;gap:7px;align-items:center;border:1px solid var(--ping-line);border-radius:12px;background:#fff;color:var(--ping-ink-2);padding:0 10px;text-align:left;font-size:9px;font-weight:740}.map-v3-place-filter-grid button>span{width:10px;height:10px;border-radius:3px;background:#27865e}.map-v3-place-filter-grid button.place-toilets>span{background:#6b5fc7}.map-v3-place-filter-grid button.place-restaurant>span{background:#df715b}.map-v3-place-filter-grid button.place-playground>span{background:#d59a2d}.map-v3-place-filter-grid button:not(.active){opacity:.52}.map-v3-place-filter-grid button b{color:var(--ping-muted);font-size:7px}.map-v3-osm-note{margin:9px 0 0;color:var(--ping-muted-2);font-size:8px;line-height:1.45}@keyframes mapV3Pulse{50%{opacity:.3}}
    @media(max-width:350px){.map-v3-controls,.map-v3-card,.map-v3-quiet,.map-v3-place-card{left:10px;right:10px}.map-v3-market-filters,.map-v3-place-filter-grid{grid-template-columns:1fr}.map-v3-market-filters label:last-child{grid-column:auto}}
  `}</style>
  </div>;
}
