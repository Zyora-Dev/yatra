"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2, BusFront, Calculator, CarFront, ClipboardCheck, Clock3, Compass, Footprints, Globe2, LoaderCircle, MapPin, Mountain, Navigation, Phone, Route, Search, SlidersHorizontal, Sparkles, Star, Sun, TrainFront, Utensils } from "lucide-react";
import { AccountDialog } from "@/components/account-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assessTrip, calculateBudget } from "@/lib/budget";
import "@/app/explore/explore.css";

type Place = {
  id: string; displayName?: { text: string }; formattedAddress?: string; types?: string[]; primaryType?: string;
  googleMapsUri?: string; websiteUri?: string; internationalPhoneNumber?: string; businessStatus?: string;
  rating?: number; userRatingCount?: number; regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: { name: string; authorAttributions?: { displayName: string; uri?: string }[] }[];
  attributions?: { provider: string; providerUri?: string }[];
};
type Category = "sights" | "stays" | "restaurants" | "spiritual" | "transport";
type TransportKind = "all" | "rail" | "bus" | "services";
const transportFilters = [
  { id: "all", label: "All transport", icon: Navigation },
  { id: "rail", label: "Railway stations", icon: TrainFront },
  { id: "bus", label: "Bus stops", icon: BusFront },
  { id: "services", label: "Travel services", icon: CarFront },
] as const;
const categories = [
  { id: "sights", label: "Discover", icon: Mountain },
  { id: "stays", label: "Stays", icon: Building2 },
  { id: "restaurants", label: "Restaurants", icon: Utensils },
  { id: "spiritual", label: "Spiritual", icon: Sun },
  { id: "transport", label: "Getting around", icon: CarFront },
] as const;
const headings = { sights: "Places worth a detour", stays: "Find your place to stay", restaurants: "Where to eat nearby", spiritual: "A little space for the soul", transport: "Make your next move" };
const nameOf = (place: Place) => place.displayName?.text || "Unnamed place";
const isRegion = (place: Place) => place.types?.some((type) => type === "country" || type === "administrative_area_level_1");

async function travelRequest<Result>(path: string, payload: object, signal: AbortSignal): Promise<Result> {
  const response = await fetch(`/api/travel/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Yatra-Request": "1" },
    body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Could not load this request. Check the destination and try again.");
  return data;
}

function Photo({ place, priority = false }: { place: Place; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photo = place.photos?.[0];
  return <div className="place-photo">
    {photo && !failed ? <Image unoptimized fill sizes="(max-width: 640px) 100vw, 50vw" priority={priority} src={`/api/travel/photo?name=${encodeURIComponent(photo.name)}`} alt={nameOf(place)} onError={() => setFailed(true)} /> : <div className="photo-unavailable"><MapPin size={28} /><span>Photo unavailable</span></div>}
    {photo && !failed && <div className="photo-credit">{photo.authorAttributions?.map((author, index) => author.uri ? <a key={index} href={author.uri} target="_blank" rel="noreferrer">{author.displayName}</a> : <span key={index}>{author.displayName}</span>)}</div>}
  </div>;
}

function Attribution({ place }: { place: Place }) {
  return <>{place.attributions?.map((item, index) => <span className="place-attribution" key={index}>{item.providerUri ? <a href={item.providerUri} target="_blank" rel="noreferrer">{item.provider}</a> : item.provider}</span>)}</>;
}

function PlaceCard({ place, onSelect, index }: { place: Place; onSelect: () => void; index: number }) {
  return <article className="live-place-card" style={{ animationDelay: `${Math.min(index, 5) * 55}ms` }}>
    <Photo key={place.photos?.[0]?.name || place.id} place={place} />
    <div className="live-place-copy">
      <span className="place-kind">{(place.primaryType || place.types?.[0] || "Destination").replaceAll("_", " ")}</span>
      <button className="place-title-button" onClick={onSelect}><h3>{nameOf(place)}</h3><ArrowUpRight size={19} /></button>
      <p><MapPin size={14} />{place.formattedAddress || "Address not supplied"}</p>
      {place.businessStatus?.startsWith("CLOSED") && <span className="closed-status">{place.businessStatus.replaceAll("_", " ")}</span>}
      <Attribution place={place} />
    </div>
  </article>;
}

type RouteResult = {
  description?: string;
  localizedValues?: { distance?: { text: string }; duration?: { text: string } };
  warnings?: string[];
  legs?: { steps?: {
    navigationInstruction?: { instructions?: string };
    travelMode?: string;
    localizedValues?: { distance?: { text: string }; staticDuration?: { text: string } };
    transitDetails?: {
      headsign?: string; stopCount?: number;
      stopDetails?: { departureStop?: { name: string }; arrivalStop?: { name: string } };
      localizedValues?: { departureTime?: { time?: { text: string }; timeZone?: string }; arrivalTime?: { time?: { text: string }; timeZone?: string } };
      transitLine?: { name?: string; nameShort?: string; agencies?: { name: string; uri?: string }[] };
    };
  }[] }[];
};

function RoutePlanner({ target, initialOrigin }: { target: Place; initialOrigin: Place | null }) {
  const [origin, setOrigin] = useState<Place | null>(initialOrigin?.id !== target.id ? initialOrigin : null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Place[] | null>(null);
  const [mode, setMode] = useState<"DRIVE" | "WALK" | "TRANSIT">("DRIVE");
  const [results, setResults] = useState<RouteResult[] | null>(null);
  const [loading, setLoading] = useState<"search" | "route" | null>(null);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function invalidate() {
    request.current?.abort(); setLoading(null); setError(""); setResults(null);
  }

  async function searchOrigin() {
    invalidate(); setMatches(null);
    const controller = new AbortController(); request.current = controller; setLoading("search");
    try {
      const data = await travelRequest<{ places: Place[] }>("destinations", { query }, controller.signal);
      if (!controller.signal.aborted) setMatches(data.places.filter((place) => !isRegion(place) && place.id !== target.id));
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Starting places unavailable."); }
    finally { if (!controller.signal.aborted) setLoading(null); }
  }

  async function findRoute() {
    if (!origin) return;
    invalidate();
    const controller = new AbortController(); request.current = controller; setLoading("route");
    try {
      const data = await travelRequest<{ routes: RouteResult[] }>("routes", { origin_place_id: origin.id, place_id: target.id, mode }, controller.signal);
      if (!controller.signal.aborted) setResults(data.routes);
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Route unavailable."); }
    finally { if (!controller.signal.aborted) setLoading(null); }
  }

  return <div className="route-planner">
    <DialogHeader><DialogTitle>Plan your route</DialogTitle><DialogDescription>To {nameOf(target)}</DialogDescription></DialogHeader>
    <div className="route-endpoint"><MapPin size={18} /><div><span>To</span><strong>{nameOf(target)}</strong><p>{target.formattedAddress}</p></div></div>
    {origin ? <div className="route-endpoint"><Navigation size={18} /><div><span>From</span><strong>{nameOf(origin)}</strong><p>{origin.formattedAddress}</p><Attribution place={origin} /></div><Button variant="ghost" onClick={() => { invalidate(); setOrigin(null); setMatches(null); }}>Change</Button></div> : <form onSubmit={(event) => { event.preventDefault(); searchOrigin(); }}>
      <label htmlFor="route-origin">Starting point</label><div className="route-origin-search"><input id="route-origin" placeholder="Station, hotel, city or address" required minLength={2} maxLength={160} value={query} onChange={(event) => { invalidate(); setQuery(event.target.value); setMatches(null); }} /><Button type="submit" size="icon" disabled={loading === "search"} aria-label="Search starting points">{loading === "search" ? <LoaderCircle className="animate-spin" /> : <Search size={18} />}</Button></div>
      {matches && <div className="route-matches" aria-live="polite">{matches.length ? matches.map((place) => <button type="button" key={place.id} onClick={() => { invalidate(); setOrigin(place); setMatches(null); }}><strong>{nameOf(place)}</strong><span>{place.formattedAddress}</span></button>) : <p>No matching starting points. Try a specific address, station or city.</p>}<span className="route-attribution" translate="no">Google Maps</span></div>}
    </form>}
    <fieldset className="route-modes"><legend>Travel mode</legend>{([{ id: "DRIVE", label: "Drive", icon: CarFront }, { id: "WALK", label: "Walk", icon: Footprints }, { id: "TRANSIT", label: "Transit", icon: TrainFront }] as const).map((item) => <label key={item.id}><input type="radio" name="route-mode" value={item.id} checked={mode === item.id} onChange={() => { invalidate(); setMode(item.id); }} /><span><item.icon size={17} />{item.label}</span></label>)}</fieldset>
    <Button className="route-submit" onClick={findRoute} disabled={!origin || Boolean(loading)}>{loading === "route" ? <LoaderCircle className="animate-spin" size={18} /> : <Route size={18} />}{loading === "route" ? "Finding route..." : error ? "Try again" : "Find route"}</Button>
    {loading && <p role="status" className="source-note">{loading === "search" ? "Searching starting points..." : "Calculating your journey..."}</p>}
    {error && <p className="workspace-error" role="alert">{error}</p>}
    {results && <div className="route-results" aria-live="polite">{results.length ? results.map((route, routeIndex) => <section key={routeIndex}>
      <h3>{route.description || "Your route"}</h3><div className="route-summary"><span><Route size={17} />{route.localizedValues?.distance?.text || "Distance unavailable"}</span><span><Clock3 size={17} />{route.localizedValues?.duration?.text || "Duration unavailable"}</span></div>
      {route.warnings?.map((warning, index) => <p className="workspace-error" key={index}>{warning}</p>)}
      <ol className="route-steps">{route.legs?.flatMap((leg) => leg.steps || []).map((step, index) => {
        const transit = step.transitDetails;
        return <li key={index}><span className="route-step-number">{index + 1}</span><div><h4>{step.navigationInstruction?.instructions || (transit ? transit.transitLine?.name || "Public transit" : step.travelMode === "WALK" ? "Walk" : "Continue")}</h4>
          <p>{[step.localizedValues?.distance?.text, step.localizedValues?.staticDuration?.text].filter(Boolean).join(" · ")}</p>
          {transit && <div className="route-transit">{transit.transitLine?.nameShort && <strong>{transit.transitLine.nameShort}</strong>}{transit.headsign && <p>Towards {transit.headsign}</p>}<p>{transit.stopDetails?.departureStop?.name || "Departure stop unavailable"} → {transit.stopDetails?.arrivalStop?.name || "Arrival stop unavailable"}</p>{transit.stopCount !== undefined && <p>{transit.stopCount} stops</p>}{(["departureTime", "arrivalTime"] as const).map((key) => { const time = transit.localizedValues?.[key]; return time?.time?.text && <p key={key}>{key === "departureTime" ? "Departs" : "Arrives"} {time.time.text} {time.timeZone && `(${time.timeZone})`}</p>; })}{transit.transitLine?.agencies?.map((agency, agencyIndex) => <p key={agencyIndex}>{agency.uri ? <a href={agency.uri} target="_blank" rel="noreferrer">{agency.name}<ArrowUpRight size={13} /></a> : agency.name}</p>)}</div>}
        </div></li>;
      })}</ol>
    </section>) : <p>No route returned for this journey and travel mode. Try another mode or starting point.</p>}<span className="route-attribution" translate="no">Google Maps</span></div>}
    <p className="source-note">{mode === "TRANSIT" ? "Departure: now. Transit coverage and schedules vary; confirm service with the operator. No live vehicle tracking." : mode === "WALK" ? "Walking routes may lack clear sidewalks or pedestrian paths. Check local conditions." : "Estimated driving time, without live traffic."} Routes are for planning, not turn-by-turn navigation.</p>
    <Attribution place={target} /><span className="route-attribution" translate="no">Google Maps</span>
  </div>;
}

type BudgetSuggestion = {
  rates: Record<"stay" | "food" | "transport" | "activities", { low: number; high: number }>;
  total: { low: number; high: number };
  per_person: { low: number; high: number };
};

function TripRealityCheck({ days, currency, estimatedTotal, upperEstimate, journey }: { days: number; currency: string; estimatedTotal: number | null; upperEstimate: number | null; journey: number }) {
  const [values, setValues] = useState({ spendingLimit: "", stops: "", visitHours: "1.5", transferHours: "", breakHours: "1" });
  const [dailyHours, setDailyHours] = useState("6");
  const optional = (value: string) => value.trim() === "" ? null : Number(value);
  let result: ReturnType<typeof assessTrip> | null = null;
  try {
    if (values.visitHours !== "" && values.breakHours !== "") result = assessTrip({ days, dailyHours: Number(dailyHours), breakHours: Number(values.breakHours), visitHours: Number(values.visitHours), stops: optional(values.stops), transferHours: optional(values.transferHours), spendingLimit: optional(values.spendingLimit), estimatedTotal, upperEstimate });
  } catch {}
  const money = (amount: number) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  const hours = (amount: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(amount);
  const fields = [
    ["spendingLimit", `Group spending limit (${currency})`, "0.01", "0.01", undefined],
    ["stops", "Planned stops / whole trip", "0", "1", "300"],
    ["visitHours", "Hours at each stop", "0.25", "0.25", "24"],
    ["transferHours", "All travel hours / whole trip", "0", "0.25", undefined],
    ["breakHours", "Break hours / day", "0", "0.25", "15"],
  ] as const;
  let adjustment = "Add the missing time and budget inputs before choosing an adjustment.";
  if (result?.timeStatus === "over") adjustment = result.transferOverload
    ? "Reduce travel time or add a day, then check again. Travel and breaks alone exceed your available hours."
    : `Reduce your plan to ${result.maxStops} stops or fewer. That fits your declared visit, travel and break allowances; costs still need checking.`;
  else if (result?.budgetStatus === "over") adjustment = `Reduce the entered group costs by at least ${money(estimatedTotal! - Number(values.spendingLimit))}, then check the plan again.`;
  else if (result?.budgetStatus === "tight") adjustment = `Leave another ${money(upperEstimate! - Number(values.spendingLimit))} of room in your budget for the upper estimate, or revise your costs.`;
  else if (result?.timeStatus === "within" && result.budgetStatus === "within") adjustment = "Keep this pace and confirm the longest travel leg before adding another stop.";
  return <details className="trip-check">
    <summary><ClipboardCheck size={19} /><span>Trip reality check<small>Time, pace & spending</small></span></summary>
    <div className="trip-check-body">
      <h3>Is this trip doable?</h3>
      <p className="source-note">{days || "-"} days. Time allowances are your estimates; costs come from the budget below.</p>
      <label className="trip-check-field">Daily pace<select value={dailyHours} onChange={(event) => setDailyHours(event.target.value)}><option value="4">Relaxed - 4 hours/day</option><option value="6">Balanced - 6 hours/day</option><option value="8">Full - 8 hours/day</option></select></label>
      <div className="trip-check-fields">{fields.map(([key, label, min, step, max]) => <label className="trip-check-field" key={key}>{label}<input type="number" min={min} max={max} step={step} placeholder="Not set" value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} /></label>)}</div>
      <p className="source-note">Daily hours include visits, travel and breaks. Travel hours include all transfers and any arrival/return travel within these days. Pace presets are planning allowances, not health or accessibility advice.</p>
      {!result ? <p className="workspace-error" role="alert">Enter valid trip days and non-negative amounts. Visits need a positive duration, stops must be whole numbers, and breaks must be shorter than the daily allowance.</p> : <div className="trip-check-result" aria-live="polite">
        <h4>{result.timeStatus === "over" || result.budgetStatus === "over" ? "Your plan needs adjusting" : result.budgetStatus === "tight" ? "The budget looks tight" : result.timeStatus === "missing" || result.budgetStatus === "missing" ? "A few details are missing" : "Fits the entered allowances"}</h4>
        <dl><div><dt><Clock3 size={15} />Time</dt><dd>{result.requiredHours === null ? "Add planned stops and total travel hours." : `${hours(result.requiredHours)}h planned / ${hours(result.availableHours)}h available across ${days} days.`}</dd></div><div><dt><Calculator size={15} />Spending</dt><dd>{result.budgetStatus === "missing" ? "Add a spending limit and complete the budget estimate." : `${money(estimatedTotal!)} entered / ${money(Number(values.spendingLimit))} limit for the group.`}</dd></div></dl>
        {result.budgetStatus === "tight" && <p>The AI upper estimate exceeds your limit, even though the midpoint fits.</p>}
        <div className="trip-adjustment"><strong>One practical adjustment</strong><p>{adjustment}</p></div>
      </div>}
      <div className="trip-unknowns"><strong>Still unverified</strong><ul><li>Route times, weather, date-specific opening hours and accessibility.</li><li>{journey > 0 ? "Destination travel cost is user-entered, not a verified fare." : "Travel to/from the destination has no positive cost entered."}</li><li>Visa, insurance, shopping, extra taxes and a contingency allowance.</li></ul><p>This is a constraint check, not a confirmed itinerary or a guarantee of affordability.</p></div>
    </div>
  </details>;
}

function BudgetPlanner({ destination, active }: { destination: Place; active: boolean }) {
  const [currency, setCurrency] = useState("INR");
  const [style, setStyle] = useState("comfort");
  const [counts, setCounts] = useState({ days: "3", nights: "2", travellers: "2", rooms: "1" });
  const [rates, setRates] = useState({ stay: "", food: "", transport: "", activities: "", journey: "0" });
  const [result, setResult] = useState<{ key: string; data?: BudgetSuggestion; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [edited, setEdited] = useState(false);
  const payload = JSON.stringify({ place_id: destination.id, currency, style, ...Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value)])) });
  const validCounts = Object.entries(counts).every(([key, value]) => value !== "" && Number.isInteger(Number(value)) && Number(value) >= (key === "nights" ? 0 : 1) && Number(value) <= (key === "days" ? 60 : key === "nights" ? 59 : 30)) && Number(counts.nights) <= Number(counts.days) && Number(counts.rooms) <= Number(counts.travellers);
  const requestKey = `${payload}:${retry}`;
  const current = result?.key === requestKey ? result : null;
  const suggesting = validCounts && !current;

  useEffect(() => {
    if (!active || !validCounts || result?.key === requestKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const data = await travelRequest<BudgetSuggestion>("budget", JSON.parse(payload), controller.signal);
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data });
          setRates((previous) => ({ ...previous, ...Object.fromEntries(Object.entries(data.rates).map(([key, range]) => [key, String(Math.round((range.low + range.high) / 2))])) }));
          setEdited(false);
        }
      } catch (failure) {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: failure instanceof Error ? failure.message : "Budget estimate unavailable." });
      }
    }, 900);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [active, validCounts, payload, requestKey, result?.key]);

  function updateCount(key: keyof typeof counts, value: string) {
    setCounts((previous) => ({ ...previous, [key]: value,
      ...(key === "days" ? { nights: value === "" ? "" : String(Math.max(0, Number(value) - 1)) } : {}),
      ...(key === "travellers" ? { rooms: value === "" ? "" : String(Math.max(1, Math.ceil(Number(value) / 2))) } : {}),
    }));
  }
  const fields = [
    ["stay", "Stay", "per room / night"], ["food", "Food", "per person / day"],
    ["transport", "Local transport", "whole group / day"], ["activities", "Activities", "per person / trip"], ["journey", "Travel to destination", "whole group / trip"],
  ] as const;
  let estimate: ReturnType<typeof calculateBudget> | null = null;
  const complete = [...Object.values(counts), ...Object.values(rates)].every((value) => value.trim() !== "");
  try {
    if (complete && validCounts && current?.data) estimate = calculateBudget({ days: Number(counts.days), nights: Number(counts.nights), travellers: Number(counts.travellers), rooms: Number(counts.rooms), stay: Number(rates.stay), food: Number(rates.food), transport: Number(rates.transport), activities: Number(rates.activities), journey: Number(rates.journey) });
  } catch {}
  const money = (amount: number) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  return <div className="budget-planner">
    <div className="planner-title"><span className="planner-icon pink"><Calculator size={20} /></span><div><h3>A budget for {nameOf(destination)}</h3><p>Approximate costs by GPT-4.1</p></div></div>
    <div className="budget-counts">{(["travellers", "days"] as const).map((key) => <label key={key}>{key}<input type="number" min="1" max={key === "days" ? 60 : 30} step="1" value={counts[key]} onChange={(event) => updateCount(key, event.target.value)} /></label>)}</div>
    <label className="currency-field">Travel style<select value={style} onChange={(event) => setStyle(event.target.value)}><option value="budget">Budget</option><option value="comfort">Comfort</option><option value="premium">Premium</option></select></label>
    <label className="currency-field">Currency<select value={currency} onChange={(event) => { setCurrency(event.target.value); setRates({ stay: "", food: "", transport: "", activities: "", journey: "0" }); }}>{["INR", "USD", "EUR", "GBP", "JPY", "AED", "SGD", "AUD"].map((item) => <option key={item}>{item}</option>)}</select></label>
    <div className="budget-counts">{(["nights", "rooms"] as const).map((key) => <label key={key}>{key}<input type="number" min={key === "nights" ? 0 : 1} max={key === "nights" ? 59 : 30} step="1" value={counts[key]} onChange={(event) => updateCount(key, event.target.value)} /></label>)}</div>
    <p className="source-note">Assumes {counts.nights || "0"} nights and {counts.rooms || "0"} rooms, sharing up to two people per room.</p>
    <TripRealityCheck key={currency} days={Number(counts.days)} currency={currency} estimatedTotal={estimate?.total ?? null} upperEstimate={estimate && current?.data && !edited ? current.data.total.high + Number(rates.journey) : null} journey={Number(rates.journey)} />
    {!validCounts ? <p role="alert" className="workspace-error">Use 1-30 travellers, 1-60 days, nights no greater than days, and rooms no greater than travellers.</p> : suggesting ? <p className="detail-loading" role="status"><LoaderCircle className="animate-spin" size={18} /> Estimating your trip...</p> : current?.error ? <div className="workspace-error" role="alert"><p>{current.error}</p><Button variant="outline" onClick={() => setRetry(retry + 1)}>Try again</Button></div> : null}
    {validCounts && current?.data && <>
      <div className="budget-total" aria-live="polite"><span>Approximate trip range</span><strong>{money(current.data.total.low)} - {money(current.data.total.high)}</strong><small>{money(current.data.per_person.low)} - {money(current.data.per_person.high)} per person</small></div>
      <div className="budget-rates">{fields.map(([key, label, unit]) => <label key={key}><span>{label}<small>{unit}</small>{key !== "journey" && <small>{money(current.data!.rates[key].low)} - {money(current.data!.rates[key].high)}</small>}</span><input aria-label={`${label}, ${unit}`} type="number" min="0" step="0.01" placeholder="Not set" value={rates[key]} onChange={(event) => { setRates({ ...rates, [key]: event.target.value }); setEdited(true); }} /></label>)}</div>
      <div className="budget-total" aria-live="polite"><span>{edited ? "Your adjusted estimate" : "Midpoint estimate"}</span><strong>{estimate ? money(estimate.total) : "Check your amounts"}</strong>{estimate && <small>{money(estimate.perPerson)} per person</small>}</div>
      {!estimate && <p role="alert" className="workspace-error">Enter valid non-negative amounts in every cost field.</p>}
    </>}
    <p className="source-note">AI approximations, not accurate or live quotes. Costs vary with dates and availability. Travel to/from the destination, visas, insurance, shopping and extra taxes are excluded from the suggested range. Currency estimates are not verified exchange rates.</p>
  </div>;
}

export function DestinationWorkspace({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [candidates, setCandidates] = useState<Place[]>([]);
  const [destination, setDestination] = useState<Place | null>(null);
  const [region, setRegion] = useState<Place | null>(null);
  const [regionPlaces, setRegionPlaces] = useState<Place[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [category, setCategory] = useState<Category>("sights");
  const [transportKind, setTransportKind] = useState<TransportKind>("all");
  const [routeTarget, setRouteTarget] = useState<Place | null>(null);
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(Boolean(initialQuery));
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [detail, setDetail] = useState<Place | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [preferences, setPreferences] = useState("");
  const [aiPlaces, setAiPlaces] = useState<Place[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [plannerTab, setPlannerTab] = useState("ai");
  const mainRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const aiRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!initialQuery) return;
    const controller = new AbortController();
    mainRequest.current = controller;
    travelRequest<{ places: Place[] }>("destinations", { query: initialQuery }, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setCandidates(data.places); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Search unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialQuery, retry]);

  useEffect(() => () => { mainRequest.current?.abort(); detailRequest.current?.abort(); aiRequest.current?.abort(); }, []);

  async function loadNearby(place: Place, nextCategory = category, nextRadius = radius, nextTransportKind = transportKind) {
    if (isRegion(place)) { await loadRegion(place); return; }
    mainRequest.current?.abort(); aiRequest.current?.abort();
    const controller = new AbortController(); mainRequest.current = controller;
    setDestination(place); setCategory(nextCategory); setRadius(nextRadius); setLoading(true); setError(""); setPlaces([]); setAiPlaces(null); setAiError(""); setAiLoading(false);
    setTransportKind(nextTransportKind); setRouteTarget(null);
    try {
      const data = await travelRequest<{ destination: Place; places: Place[] }>("nearby", { place_id: place.id, category: nextCategory, radius_km: nextRadius, transport_kind: nextTransportKind }, controller.signal);
      if (!controller.signal.aborted) { setDestination(data.destination); setPlaces(data.places); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Places unavailable."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }

  async function openDetails(place: Place) {
    detailRequest.current?.abort();
    const controller = new AbortController(); detailRequest.current = controller;
    setDetail(place); setDetailLoading(true); setDetailError("");
    try {
      const data = await travelRequest<Place>("details", { place_id: place.id }, controller.signal);
      if (!controller.signal.aborted) setDetail(data);
    } catch (failure) { if (!controller.signal.aborted) setDetailError(failure instanceof Error ? failure.message : "Details unavailable."); }
    finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }

  async function loadRegion(place: Place) {
    mainRequest.current?.abort(); aiRequest.current?.abort();
    const controller = new AbortController(); mainRequest.current = controller;
    setDestination(null); setRegion(place); setRegionPlaces([]); setLoading(true); setError(""); setPlaces([]); setAiPlaces(null); setAiError(""); setAiLoading(false);
    try {
      const data = await travelRequest<{ region: Place; places: Place[] }>("region-destinations", { place_id: place.id }, controller.signal);
      if (!controller.signal.aborted) { setRegion(data.region); setRegionPlaces(data.places); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Destinations unavailable."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }

  async function suggest() {
    if (!destination) return;
    aiRequest.current?.abort();
    const controller = new AbortController(); aiRequest.current = controller;
    setAiLoading(true); setAiError(""); setAiPlaces(null);
    try {
      const data = await travelRequest<{ places: Place[] }>("suggestions", { place_id: destination.id, category, radius_km: radius, transport_kind: transportKind, preferences }, controller.signal);
      if (!controller.signal.aborted) setAiPlaces(data.places);
    } catch (failure) { if (!controller.signal.aborted) setAiError(failure instanceof Error ? failure.message : "Suggestions unavailable."); }
    finally { if (!controller.signal.aborted) setAiLoading(false); }
  }

  function changeDestination() {
    mainRequest.current?.abort(); aiRequest.current?.abort();
    setRouteTarget(null);
    setDestination(null); setPlaces([]); setError(""); setLoading(false); setAiLoading(false); setAiPlaces(null);
  }

  const selection = region ? regionPlaces : candidates;

  return <div className="destination-workspace">
    <a className="skip-link" href="#live-results">Skip to results</a>
    <header className="workspace-header"><div className="workspace-shell workspace-header-inner">
      <Link href="/" className="wordmark" aria-label="Yatra home"><span className="brand-icon"><Compass /></span>yatra<span className="brand-dot">.</span></Link>
      <form className="workspace-search" onSubmit={(event) => { event.preventDefault(); if (query.trim().length >= 2) { changeDestination(); setRegion(null); setRegionPlaces([]); setLoading(true); if (query.trim() === initialQuery) { setRetry(retry + 1); } else router.push(`/explore?q=${encodeURIComponent(query.trim())}`); } }}><Search size={18} /><input aria-label="Search destinations worldwide" placeholder="A city, a landmark, somewhere new..." value={query} minLength={2} maxLength={160} required onChange={(event) => setQuery(event.target.value)} /><Button size="icon" aria-label="Search destinations" type="submit"><ArrowRight size={18} /></Button></form>
      <AccountDialog />
    </div></header>
    <main className="workspace-shell">
      <div className="workspace-breadcrumb"><Link href="/"><ArrowLeft size={14} /> Inspiration</Link><span>/</span><span>{destination ? nameOf(destination) : "Find a destination"}</span><Link href={destination ? `/together?destination=${encodeURIComponent(nameOf(destination))}` : "/together"}>Trip Together<ArrowRight size={14} /></Link><span className="global-label"><Globe2 size={14} /> A world to explore</span></div>
      {destination ? <section className="destination-banner">
        <Photo key={destination.id} place={destination} priority />
        <div className="destination-banner-copy"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>{nameOf(destination)}</h1><p><MapPin size={17} />{destination.formattedAddress}</p><div className="destination-banner-actions"><Button onClick={changeDestination} variant="secondary"><Navigation size={15} /> Change destination</Button>{destination.googleMapsUri && <Button variant="secondary" asChild><a href={destination.googleMapsUri} target="_blank" rel="noreferrer">Google Maps <ArrowUpRight size={15} /></a></Button>}</div></div>
      </section> : <section className="destination-intro"><span className="eyebrow">FOLLOW YOUR CURIOSITY</span><h1>{region ? `Destinations in ${nameOf(region)}` : initialQuery ? `Find your ${initialQuery}.` : "Where are we heading?"}</h1><p>{region ? "Landmarks and places to explore" : initialQuery ? "Choose your destination" : "Cities, landmarks and escapes around the world"}</p>{region && <Button variant="ghost" onClick={() => { changeDestination(); setRegion(null); setRegionPlaces([]); }}><ArrowLeft size={16} />Back to search results</Button>}</section>}

      <div className={destination ? "destination-layout" : "destination-selection"}>
        <section id="live-results" className="live-results" aria-busy={loading}>
          {destination && <><Tabs value={category} onValueChange={(value) => loadNearby(destination, value as Category)}><TabsList className="destination-tabs">{categories.map((item) => <TabsTrigger value={item.id} key={item.id}><item.icon size={17} />{item.label}</TabsTrigger>)}</TabsList></Tabs>
            <div className="results-heading"><div><span className="eyebrow">{categories.find((item) => item.id === category)?.label}</span><h2>{headings[category]}</h2></div><label className="radius-control"><SlidersHorizontal size={16} /><span className="sr-only">Search radius</span><select aria-label="Search radius" value={radius} onChange={(event) => loadNearby(destination, category, Number(event.target.value))}>{[2, 5, 10, 25, 50].map((distance) => <option key={distance} value={distance}>{distance} km</option>)}</select></label></div>
            {category === "transport" && <div className="transport-controls"><fieldset className="transport-filters"><legend className="sr-only">Transport type</legend>{transportFilters.map((item) => <label key={item.id}><input type="radio" name="transport-kind" checked={transportKind === item.id} onChange={() => loadNearby(destination, category, radius, item.id)} /><span><item.icon size={16} />{item.label}</span></label>)}</fieldset><Button variant="outline" onClick={() => setRouteTarget(destination)}><Route size={16} />Plan route here</Button></div>}
            <div className="results-meta"><span>{loading ? "Finding nearby places..." : `${places.length} places returned`}</span><span>Within {radius} km of the selected location</span></div></>}
          {error && <div className="workspace-error" role="alert"><p>{error}</p><Button variant="outline" onClick={() => { if (destination) loadNearby(destination); else if (region) loadRegion(region); else { setError(""); setLoading(true); setRetry(retry + 1); } }}>Try again</Button>{destination && <Button variant="ghost" onClick={changeDestination}>Choose another destination</Button>}</div>}
          {loading ? <div className="live-place-grid" role="status" aria-label="Loading places">{[0, 1, 2, 3].map((item) => <div key={item} className="place-skeleton"><div /><span /><span /></div>)}</div> : !error && <div className="live-place-grid">{(destination ? places : selection).map((place, index) => <PlaceCard key={place.id} place={place} index={index} onSelect={() => destination ? openDetails(place) : loadNearby(place)} />)}</div>}
          {!loading && !error && !(destination ? places : selection).length && <div className="destination-empty"><Compass size={38} /><h2>{region && !destination ? "No destinations returned for this region" : initialQuery ? "No places found this time" : "Your next journey starts here"}</h2><p>{destination ? "Try another category or a wider radius." : "Search for a city or landmark, including its country for a closer match."}</p></div>}
          <div className="google-attribution"><span>Google Maps</span><p>Place information from Google Maps. Results are not exhaustive; details may change.</p></div>
        </section>

        {destination && <aside className="trip-sidebar"><Tabs value={plannerTab} onValueChange={setPlannerTab}><TabsList className="planner-tabs"><TabsTrigger value="ai"><Sparkles size={16} /> For you</TabsTrigger><TabsTrigger value="budget"><Calculator size={16} /> Budget</TabsTrigger></TabsList>
          <TabsContent value="ai"><div className="ai-planner"><div className="planner-title"><span className="planner-icon"><Sparkles size={22} /></span><div><h3>A little more you.</h3><p>Powered by GPT-4.1</p></div></div><form onSubmit={(event) => { event.preventDefault(); suggest(); }}><label htmlFor="trip-preferences">What does a good trip look like?</label><textarea id="trip-preferences" placeholder="Quiet gardens, local culture, a relaxed pace..." value={preferences} minLength={3} maxLength={800} required onChange={(event) => { setPreferences(event.target.value); aiRequest.current?.abort(); setAiLoading(false); setAiPlaces(null); }} /><div className="ai-context"><MapPin size={14} />{categories.find((item) => item.id === category)?.label} within {radius} km</div><Button className="ai-submit" type="submit" disabled={aiLoading || loading || !!error}>{aiLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {aiLoading ? "Finding your favourites..." : "Find my kind of places"}</Button></form>
            {aiError && <p className="workspace-error" role="alert">{aiError}</p>}
            {aiPlaces && <div className="ai-shortlist" aria-live="polite"><h4>Your suggested shortlist</h4>{aiPlaces.length ? aiPlaces.map((place, index) => <button key={place.id} onClick={() => openDetails(place)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{nameOf(place)}</strong><small>{(place.primaryType || "Place").replaceAll("_", " ")}</small></div><ArrowUpRight size={17} /></button>) : <p>No matching places were returned for this area.</p>}</div>}
            <p className="source-note">AI-selected from Google place results, not a verified itinerary. Suitability, accessibility and current conditions need checking with the venue.</p></div></TabsContent>
          <TabsContent value="budget" forceMount className="data-[state=inactive]:hidden"><BudgetPlanner key={destination.id} destination={destination} active={plannerTab === "budget"} /></TabsContent>
        </Tabs><div className="trip-note"><Navigation size={21} /><p>A little planning.<br /><strong>A lot to discover.</strong></p></div></aside>}
      </div>
    </main>
    <footer className="workspace-shell workspace-footer"><span>yatra. <span>Go somewhere that stays with you.</span></span><Link href="/">Back to inspiration <ArrowUpRight size={14} /></Link></footer>
    <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) { detailRequest.current?.abort(); setDetail(null); } }}><DialogContent className="live-detail-dialog">{detail && <><Photo key={detail.id} place={detail} /><div className="live-detail-content"><DialogHeader><span className="eyebrow">{(detail.primaryType || "Place details").replaceAll("_", " ")}</span><DialogTitle>{nameOf(detail)}</DialogTitle><DialogDescription>{detail.formattedAddress || "Address not supplied"}</DialogDescription></DialogHeader>
      {detailLoading ? <p className="detail-loading" role="status"><LoaderCircle className="animate-spin" size={18} /> Loading contact details...</p> : detailError ? <div role="alert" className="workspace-error">{detailError}<Button variant="outline" onClick={() => openDetails(detail)}>Retry details</Button></div> : <><div className="detail-facts">{detail.rating !== undefined && <span><Star size={17} />{detail.rating} <small>({detail.userRatingCount ?? 0} Google ratings)</small></span>}{detail.businessStatus && <span>{detail.businessStatus.replaceAll("_", " ")}</span>}</div><div className="detail-links">{detail.internationalPhoneNumber ? <Button variant="outline" asChild><a href={`tel:${detail.internationalPhoneNumber.replace(/[^+\d]/g, "")}`}><Phone size={16} />{detail.internationalPhoneNumber}</a></Button> : <p>Phone not supplied</p>}{detail.websiteUri ? <Button variant="outline" asChild><a href={detail.websiteUri} target="_blank" rel="noreferrer"><Globe2 size={16} />Website<ArrowUpRight size={14} /></a></Button> : <p>Website not supplied</p>}</div><div className="opening-hours"><h3>Opening hours</h3>{detail.regularOpeningHours?.weekdayDescriptions?.length ? <ul>{detail.regularOpeningHours.weekdayDescriptions.map((day) => <li key={day}>{day}</li>)}</ul> : <p>Hours not supplied by Google.</p>}</div></>}
      {detail.googleMapsUri && <Button asChild className="map-link"><a href={detail.googleMapsUri} target="_blank" rel="noreferrer"><MapPin size={16} /> View on Google Maps <ArrowUpRight size={16} /></a></Button>}
      {!isRegion(detail) && <Button className="nearby-detail" onClick={() => { detailRequest.current?.abort(); setRouteTarget(detail); setDetail(null); }}><Route size={16} />Route to this place</Button>}
      <Attribution place={detail} /><p className="source-note">Google Maps data. Confirm details directly before visiting. Hotel rates and availability are not provided.</p><Button variant="ghost" className="nearby-detail" onClick={() => { detailRequest.current?.abort(); setDetail(null); loadNearby(detail); }}><Navigation size={16} />Explore around this place<ArrowRight size={16} /></Button></div></>}</DialogContent></Dialog>
    <Dialog open={Boolean(routeTarget)} onOpenChange={(open) => { if (!open) setRouteTarget(null); }}><DialogContent className="live-detail-dialog route-dialog">{routeTarget && <RoutePlanner key={routeTarget.id} target={routeTarget} initialOrigin={destination} />}</DialogContent></Dialog>
  </div>;
}