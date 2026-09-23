"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Compass, Copy, GitFork, KeyRound, LoaderCircle, LockKeyhole, MapPin, Plus, RefreshCw, Scale, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { AccountDialog, type Account } from "@/components/account-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { destinations } from "@/lib/destinations";

const interests = ["culture", "nature", "food", "spiritual", "relaxation", "adventure", "shopping"] as const;
const currencies = ["INR", "USD", "EUR", "GBP", "JPY", "AED", "SGD", "AUD"];
type Interest = typeof interests[number];
type Preferences = { budget: number; pace: string; interests: Interest[]; must_haves: Interest[] };
type TripSummary = { id: string; title: string; destination: string; days: number; currency: string; created_at: string };
type Plan = { ready: boolean; submitted: number; members: number; pace?: string; different_paces?: boolean; budget_status?: string; slots?: { day: number; period: string; themes: string[]; split: boolean }[]; fairness?: { alias: string; coverage: number; must_haves_met: boolean }[]; adjustment?: string };
type Trip = TripSummary & { proposed_cost: number | null; is_owner: boolean; my_alias: string; my_preferences: Preferences | null; members: { alias: string; submitted: boolean }[]; plan: Plan };

class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<Result>(path: string, method = "GET", body?: object, signal?: AbortSignal): Promise<Result> {
  const response = await fetch(`/api/together${path}`, {
    method, credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Yatra-Request": "1" },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new RequestError(typeof error.detail === "string" ? error.detail : "Check the form values and try again.", response.status);
  }
  return response.status === 204 ? undefined as Result : response.json();
}

function PreferenceForm({ trip, pending, save }: { trip: Trip; pending: boolean; save: (body: Preferences) => void }) {
  const [selected, setSelected] = useState<Interest[]>(trip.my_preferences?.interests ?? []);
  const [musts, setMusts] = useState<Interest[]>(trip.my_preferences?.must_haves ?? []);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length) { setError("Choose at least one interest."); return; }
    const data = new FormData(event.currentTarget);
    setError("");
    save({ budget: Number(data.get("budget")), pace: String(data.get("pace")), interests: selected, must_haves: musts });
  }
  return <form className="together-form" onSubmit={submit}>
    <fieldset disabled={pending}>
      <div className="together-section-title"><LockKeyhole size={20} /><h2>Your preferences</h2></div>
      <p className="together-note">Your raw answers are visible only to you. The group sees the resulting outline, coverage scores and whether its proposed cost fits everyone. Those summaries may indirectly reveal preferences or constraints.</p>
      <div className="together-fields"><label>Your whole-trip spending limit ({trip.currency})<input name="budget" type="number" required min="0.01" max="100000000" step="0.01" defaultValue={trip.my_preferences?.budget ?? ""} /></label><label>Preferred pace<select name="pace" defaultValue={trip.my_preferences?.pace ?? "balanced"}><option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="full">Full</option></select></label></div>
      <fieldset className="together-choices"><legend>Interests</legend>{interests.map((interest) => <label key={interest}><input type="checkbox" checked={selected.includes(interest)} onChange={(event) => { setSelected(event.target.checked ? [...selected, interest] : selected.filter((value) => value !== interest)); if (!event.target.checked) setMusts(musts.filter((value) => value !== interest)); }} /><span>{interest}</span></label>)}</fieldset>
      <fieldset className="together-choices"><legend>Must-haves</legend>{selected.length ? selected.map((interest) => <label key={interest}><input type="checkbox" checked={musts.includes(interest)} onChange={(event) => setMusts(event.target.checked ? [...musts, interest] : musts.filter((value) => value !== interest))} /><span>{interest}</span></label>) : <p className="together-note">No interests selected yet.</p>}</fieldset>
      <p className="together-note">Saving includes your answers in the group calculation. A split block counts as one activity per traveller. Must-haves are checked, not guaranteed.</p>
      {error && <p role="alert" className="together-error">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}Save my preferences</Button>
    </fieldset>
  </form>;
}

function SharedPlan({ trip }: { trip: Trip }) {
  const plan = trip.plan;
  if (!plan.ready) return <div className="together-empty"><UsersRound size={32} /><h2>Waiting for the group</h2><p>{plan.submitted} of {plan.members} preferences submitted. At least two travellers and everyone&apos;s answers are needed.</p></div>;
  return <section className="together-plan">
    <div className="together-section-title"><GitFork size={21} /><h2>A shared starting point</h2><span className="together-status">Draft</span></div>
    <div className="together-summary"><p><strong className="capitalize">{plan.pace} shared pace</strong>{plan.different_paces ? "Optional extras for fuller days; shared blocks follow the gentlest requested pace." : "Everyone selected the same pace."}</p><p><strong>{plan.budget_status === "within" ? "Within all entered limits" : plan.budget_status === "over" ? "Spending needs a rethink" : "Cost not entered yet"}</strong>{plan.budget_status === "within" ? "The proposed whole-trip cost per person fits all submitted limits. It is not a verified quote." : plan.budget_status === "over" ? "At least one private limit is below the proposed per-person cost." : "The organiser can enter an approximate whole-trip cost per person."}</p></div>
    <div className="together-days">{Array.from({ length: trip.days }, (_, index) => <section className="together-day" key={index}><h3>Day {index + 1}</h3>{plan.slots?.filter((slot) => slot.day === index + 1).map((slot) => <div className="together-slot" key={slot.period}><span>{slot.period}</span><strong>{slot.themes.join(" or ")}</strong><small>{slot.split ? "Optional split; choose one" : slot.themes[0] === "free time" ? "Keep flexible" : "Shared activity theme"}</small></div>)}<p>Regroup for an evening catch-up</p></section>)}</div>
    <section className="together-fairness"><div className="together-section-title"><Scale size={21} /><h2>Everyone gets a say</h2></div><p className="together-note">Selected-interest coverage, not a satisfaction score. One option per split block; unvisited interests and clashing must-haves remain gaps.</p><ul>{plan.fairness?.map((member) => <li key={member.alias}><div><strong>{member.alias}</strong><span>{member.coverage}% coverage</span></div><progress aria-label={`${member.alias} interest coverage`} value={member.coverage} max={100} /><small>{member.must_haves_met ? "No unmet must-haves" : "Some must-haves are unmet"}</small></li>)}</ul></section>
    <div className="together-adjustment"><h3>One adjustment</h3><p>{plan.adjustment}</p></div>
    <p className="together-note">Activity themes only, not a timed itinerary. Routes, opening hours, weather, availability, accessibility and costs are unverified. Split activities need the group&apos;s agreement; no traveller is required to separate.</p>
    <Button asChild variant="outline"><Link href={`/explore?q=${encodeURIComponent(trip.destination)}`}><Compass />Find places in {trip.destination}<ArrowRight /></Link></Button>
  </section>;
}

export function TogetherWorkspace({ initialDestination }: { initialDestination: string }) {
  const [account, setAccount] = useState<Account | null>();
  const [loadedFor, setLoadedFor] = useState("");
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("preferences");
  const [entry, setEntry] = useState("create");
  const [createdAfter, setCreatedAfter] = useState("");
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [retry, setRetry] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const photo = destinations.find((place) => place.id === "goa")!;

  const changeAccount = useCallback((next: Account | null) => {
    activeRequest.current?.abort();
    setAccount(next); setLoadedFor(""); setTrips([]); setTrip(null); setInvite(null);
    setError(""); setNotice(""); setConfirm(false); setCreatedAfter("");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    activeRequest.current?.abort();
    if (account) request<TripSummary[]>("", "GET", undefined, controller.signal).then((data) => {
      if (!controller.signal.aborted) { setTrips(data); setTrip(null); setInvite(null); setError(""); setNotice(""); setLoadedFor(account.id); }
    }).catch((failure) => { if (!controller.signal.aborted) { setTrips([]); setTrip(null); setInvite(null); setError(failure instanceof Error ? failure.message : "Unable to load trips."); setLoadedFor(account.id); if (failure instanceof RequestError && failure.status === 401) changeAccount(null); } });
    return () => { controller.abort(); activeRequest.current?.abort(); };
  }, [account, retry, changeAccount]);

  async function act(action: (signal: AbortSignal) => Promise<void>) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true); setError(""); setNotice("");
    try { await action(controller.signal); }
    catch (failure) { if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : "Unable to complete this request."); if (failure instanceof RequestError && failure.status === 401) changeAccount(null); } }
    finally { if (activeRequest.current === controller) setPending(false); }
  }

  function openTrip(next: Trip) { setTrip(next); setInvite(null); setTab("preferences"); }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void act(async (signal) => {
      const next = await request<Trip>("", "POST", { title: data.get("title"), destination: data.get("destination"), alias: data.get("alias"), days: Number(data.get("days")), currency: data.get("currency"), proposed_cost: data.get("cost") === "" ? null : Number(data.get("cost")) }, signal);
      if (!signal.aborted) { openTrip(next); setTrips((current) => [next, ...current]); setNotice("Trip created. Invite your fellow travellers."); }
    });
  }
  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void act(async (signal) => {
      const next = await request<Trip>("/join", "POST", { code: String(data.get("code")).trim(), alias: data.get("alias") }, signal);
      if (!signal.aborted) { openTrip(next); setTrips((current) => [next, ...current.filter((item) => item.id !== next.id)]); setNotice("You joined the trip."); }
    });
  }
  function savePreferences(body: Preferences) {
    if (!trip) return;
    void act(async (signal) => { const next = await request<Trip>(`/${trip.id}/preferences`, "PUT", body, signal); if (!signal.aborted) { setTrip(next); setTab("plan"); setNotice("Your preferences are saved."); } });
  }
  function updateTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!trip) return;
    const data = new FormData(event.currentTarget);
    void act(async (signal) => { const next = await request<Trip>(`/${trip.id}`, "PUT", { days: Number(data.get("days")), proposed_cost: data.get("cost") === "" ? null : Number(data.get("cost")) }, signal); if (!signal.aborted) { setTrip(next); setTrips((current) => current.map((item) => item.id === next.id ? next : item)); setNotice("Shared assumptions updated."); } });
  }
  const visibleTrips = trips.filter((item) => !createdAfter || item.created_at.slice(0, 10) >= createdAfter);

  return <div className="together-workspace">
    <a href="#together-main" className="skip-link">Skip to Trip Together</a>
    <header className="together-header"><div className="together-shell"><Link href="/" className="wordmark" aria-label="Yatra home"><span className="brand-icon"><Compass /></span>yatra<span className="brand-dot">.</span></Link><nav aria-label="Main navigation"><Link href="/explore">Explore</Link><Link href="/together" aria-current="page"><UsersRound size={16} />Trip Together</Link></nav><AccountDialog onAccountChange={changeAccount} /></div></header>
    <main id="together-main" className="together-shell">
      <div className="together-heading"><div><span className="together-eyebrow">A journey for everyone</span><h1>Trip Together<span>.</span></h1></div><UsersRound size={36} aria-hidden="true" /></div>
      {error && <div className="together-error" role="alert">{error}<Button variant="ghost" disabled={pending} onClick={() => setRetry((value) => value + 1)}><RefreshCw size={16} />Reload trips</Button></div>}
      {notice && account && <p className="together-notice" role="status"><Check size={16} />{notice}</p>}
      {account === undefined || (account && loadedFor !== account.id) ? <div className="together-empty" role="status"><LoaderCircle className="animate-spin" /><p>Loading your trips...</p></div> : !account ? <section className="together-welcome"><div><LockKeyhole size={28} /><h2>Start with your account</h2><p>Sign in to create a trip or join your group.</p><p className="together-note">Your individual answers stay separate from the shared plan.</p></div><Image src={photo.image} alt={photo.alt} width={520} height={280} /><small>Goa inspiration photo. Credits in the homepage photo credits.</small></section> : <div className="together-layout">
        <aside className="together-sidebar"><div className="together-section-title"><h2>Your trips</h2><span>{trips.length}/20</span><Button variant="ghost" size="icon" title="New or join trip" aria-label="New or join trip" disabled={pending} onClick={() => { setTrip(null); setInvite(null); setNotice(""); }}><Plus /></Button></div><label className="together-date">Created on or after<input type="date" value={createdAfter} onChange={(event) => setCreatedAfter(event.target.value)} /></label><ul className="together-trip-list">{visibleTrips.map((item) => <li key={item.id}><button disabled={pending} aria-current={trip?.id === item.id ? "page" : undefined} onClick={() => void act(async (signal) => { const next = await request<Trip>(`/${item.id}`, "GET", undefined, signal); if (!signal.aborted) openTrip(next); })}><strong>{item.title}</strong><span>{item.destination}</span><small>{item.days} days · {new Date(item.created_at).toLocaleDateString()}</small></button></li>)}</ul>{!visibleTrips.length && <p className="together-note">{trips.length ? "No trips match this date." : "No trips yet."}</p>}</aside>
        <div className="together-content">{!trip ? <Tabs value={entry} onValueChange={setEntry}><TabsList className="together-tabs"><TabsTrigger value="create"><Plus size={16} />Create a trip</TabsTrigger><TabsTrigger value="join"><KeyRound size={16} />Join a trip</TabsTrigger></TabsList><TabsContent value="create"><form className="together-form" onSubmit={create}><fieldset disabled={pending}><h2>Bring your people together</h2><div className="together-fields"><label>Trip name<input name="title" required maxLength={100} placeholder="Our next escape" /></label><label>Destination<input name="destination" required minLength={2} maxLength={160} defaultValue={initialDestination} placeholder="City, country" /></label><label>Your display name<input name="alias" required maxLength={40} autoComplete="nickname" /></label><label>Days<input name="days" type="number" min={1} max={14} required defaultValue={3} /></label><label>Shared currency<select name="currency" defaultValue="INR">{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label><label>Proposed whole-trip cost per person<input name="cost" type="number" min={0} max={100000000} step="0.01" placeholder="Optional estimate" /></label></div><p className="together-note">One currency for the whole group, fixed when the trip is created. Costs are entered estimates, not live quotes or conversions. No payments.</p><Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <Plus />}Create trip</Button></fieldset></form></TabsContent><TabsContent value="join"><form className="together-form" onSubmit={join}><fieldset disabled={pending}><h2>There&apos;s room for you</h2><label>Invite code<input name="code" required minLength={43} maxLength={43} autoComplete="off" spellCheck={false} /></label><label>Your display name<input name="alias" required maxLength={40} autoComplete="nickname" /></label><p className="together-note">Your display name and submission status will be visible to the group.</p><Button type="submit" disabled={pending}><KeyRound />Join trip</Button></fieldset></form></TabsContent></Tabs> : <>
          <div className="together-trip-heading"><div><span className="together-eyebrow">{trip.days} days · {trip.currency} · {trip.members.length}/12 travellers</span><h2>{trip.title}</h2><p><MapPin size={15} />{trip.destination}</p></div><div className="together-tools"><Button variant="ghost" size="icon" title="Refresh group responses" aria-label="Refresh group responses" disabled={pending} onClick={() => void act(async (signal) => { const next = await request<Trip>(`/${trip.id}`, "GET", undefined, signal); if (!signal.aborted) { setTrip(next); setNotice("Group responses refreshed."); } })}><RefreshCw className={pending ? "animate-spin" : ""} /></Button><Button variant="ghost" size="icon" title={trip.is_owner ? "Delete trip" : "Leave trip"} aria-label={trip.is_owner ? "Delete trip" : "Leave trip"} disabled={pending} onClick={() => setConfirm(true)}><Trash2 /></Button></div></div>
          <Tabs value={tab} onValueChange={setTab}><TabsList className="together-tabs"><TabsTrigger value="preferences"><LockKeyhole size={16} />My preferences</TabsTrigger><TabsTrigger value="plan"><Scale size={16} />Shared plan</TabsTrigger><TabsTrigger value="group"><UsersRound size={16} />Group</TabsTrigger></TabsList><TabsContent value="preferences"><PreferenceForm key={`${trip.id}:${JSON.stringify(trip.my_preferences)}`} trip={trip} pending={pending} save={savePreferences} />{trip.my_preferences && <Button variant="ghost" disabled={pending} onClick={() => void act(async (signal) => { const next = await request<Trip>(`/${trip.id}/preferences`, "DELETE", undefined, signal); if (!signal.aborted) { setTrip(next); setNotice("Your preferences were withdrawn."); } })}><ArrowLeft />Withdraw my preferences</Button>}</TabsContent><TabsContent value="plan"><SharedPlan trip={trip} /></TabsContent><TabsContent value="group"><section className="together-group"><h2>Your travelling circle</h2><ul className="together-members">{trip.members.map((member) => <li key={member.alias}><span><UsersRound size={17} />{member.alias}{member.alias === trip.my_alias && " (you)"}</span><span>{member.submitted ? "Submitted" : "Waiting"}</span></li>)}</ul>{trip.is_owner && <><div className="together-invite"><h3>Invite travellers</h3><p className="together-note">Anyone signed in with this code can join, up to 12 travellers. Codes expire after seven days. A new code replaces the previous one; revoking does not remove existing members.</p><div className="together-actions"><Button disabled={pending} onClick={() => void act(async (signal) => { const next = await request<{ code: string; expires_at: string }>(`/${trip.id}/invite`, "POST", undefined, signal); if (!signal.aborted) setInvite(next); })}><KeyRound />New invite code</Button><Button variant="outline" disabled={pending} onClick={() => void act(async (signal) => { await request(`/${trip.id}/invite`, "DELETE", undefined, signal); if (!signal.aborted) { setInvite(null); setNotice("Invite revoked."); } })}>Revoke invite</Button></div>{invite && <div className="together-code"><label>Invite code<input readOnly value={invite.code} onFocus={(event) => event.target.select()} /></label><Button variant="ghost" size="icon" title="Copy invite code" aria-label="Copy invite code" onClick={async () => { try { await navigator.clipboard.writeText(invite.code); setNotice("Invite code copied."); } catch { setNotice("Clipboard unavailable. Select and copy the code."); } }}><Copy /></Button><small>Expires {new Date(invite.expires_at).toLocaleDateString()}</small></div>}</div><form className="together-form" onSubmit={updateTrip}><fieldset disabled={pending}><h3>Shared assumptions</h3><div className="together-fields" key={`${trip.days}:${trip.proposed_cost}`}><label>Days<input type="number" name="days" required min={1} max={14} defaultValue={trip.days} /></label><label>Whole-trip estimate per person ({trip.currency})<input type="number" name="cost" min={0} max={100000000} step="0.01" defaultValue={trip.proposed_cost ?? ""} /></label></div><Button type="submit" variant="outline" disabled={pending}><Check />Update assumptions</Button></fieldset></form></>}</section></TabsContent></Tabs>
        </>}</div>
      </div>}
    </main>
    <Dialog open={confirm && !!account && !!trip} onOpenChange={setConfirm}><DialogContent className="account-dialog"><DialogHeader><DialogTitle>{trip?.is_owner ? "Delete this trip?" : "Leave this trip?"}</DialogTitle><DialogDescription>{trip?.is_owner ? "This permanently removes the group and all its submitted preferences." : "Your membership and private preferences will be removed."}</DialogDescription></DialogHeader><div className="together-actions"><Button variant="outline" disabled={pending} onClick={() => setConfirm(false)}>Cancel</Button><Button disabled={pending} onClick={() => { if (trip) void act(async (signal) => { await request(`/${trip.id}`, "DELETE", undefined, signal); if (!signal.aborted) { setTrips((current) => current.filter((item) => item.id !== trip.id)); setTrip(null); setInvite(null); setConfirm(false); setNotice(trip.is_owner ? "Trip deleted." : "You left the trip."); } }); }}><Trash2 />{trip?.is_owner ? "Delete trip" : "Leave trip"}</Button></div></DialogContent></Dialog>
  </div>;
}