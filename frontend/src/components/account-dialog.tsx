"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass, Eye, EyeOff, Heart, LayoutDashboard, LoaderCircle, LogOut, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { destinations } from "@/lib/destinations";

export type Account = { id: string; email: string; whatsapp: string; location: string };
type ApiError = { detail?: string | { loc: (string | number)[]; msg: string }[] };

async function accountRequest(path: string, body?: object): Promise<Account | null> {
  const response = await fetch(`/api/auth/${path}`, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: body ? { "Content-Type": "application/json", "X-Yatra-Request": "1" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (path === "me" && response.status === 401) return null;
  if (!response.ok) {
    const failure: ApiError = await response.json().catch(() => ({}));
    const message = typeof failure.detail === "string" ? failure.detail : failure.detail?.map((error) => `${error.loc.at(-1)}: ${error.msg.replace(/^Value error, /, "")}`).join(" ");
    throw new Error(message || "Account service is unavailable. Please try again.");
  }
  return response.status === 204 ? null : response.json();
}

export function AccountDialog({ onAccountChange }: { onAccountChange?: (account: Account | null) => void } = {}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("login");
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [location, setLocation] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [dashboardTab, setDashboardTab] = useState("overview");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const savedPlaces = destinations.filter((place) => savedIds.includes(place.id));

  function loadSavedPlaces() {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("yatra-saved-places") || "[]");
      setSavedIds(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setSavedIds([]);
    }
  }

  useEffect(() => {
    let active = true;
    accountRequest("me").then((user) => { if (active) { setAccount(user); onAccountChange?.(user); } })
      .catch(() => { if (active) { setError("Unable to check your session. Please try signing in."); onAccountChange?.(null); } })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [onAccountChange]);

  function changeOpen(next: boolean) {
    if (pending) return;
    if (next) loadSavedPlaces();
    setOpen(next);
    setPassword("");
    setVisible(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const user = await accountRequest(mode, mode === "register" ? { email, whatsapp, location, password } : { identifier, password });
      setAccount(user);
      onAccountChange?.(user);
      setDashboardTab("overview");
      loadSavedPlaces();
      setPassword("");
      setVisible(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setError("");
    try {
      await accountRequest("logout", {});
      setAccount(null);
      onAccountChange?.(null);
      setSavedIds([]);
      setDashboardTab("overview");
      setMode("login");
      setIdentifier("");
      setEmail("");
      setWhatsapp("");
      setLocation("");
      setPassword("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to sign out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild><Button variant="ghost" className="header-signin" disabled={checking} aria-label={checking ? "Checking session" : account ? "Dashboard" : "Sign in"} title={account ? "Dashboard" : undefined}>{account && <LayoutDashboard size={16} aria-hidden="true" />}<span className="account-trigger-label">{checking ? "Checking..." : account ? "Dashboard" : "Sign in"}</span></Button></DialogTrigger>
      <DialogContent className={`account-dialog${account ? " dashboard-dialog" : ""}`} showCloseButton={!pending}>
        <DialogHeader>
          <span className="account-mark">{account ? <LayoutDashboard size={23} /> : <UserRound size={23} />}</span>
          <DialogTitle>{account ? "Your dashboard" : mode === "register" ? "Create your account" : "Welcome back"}</DialogTitle>
          <DialogDescription>{account ? "A little space for your next journey." : mode === "register" ? "A new journey starts here." : "Sign in to Yatra."}</DialogDescription>
        </DialogHeader>
        {account ? <>
          <Tabs value={dashboardTab} onValueChange={setDashboardTab} className="dashboard-tabs">
            <TabsList className="dashboard-menu" aria-label="Dashboard menu">
              <TabsTrigger value="overview"><LayoutDashboard size={15} />Overview</TabsTrigger>
              <TabsTrigger value="saved"><Heart size={15} />Saved places</TabsTrigger>
              <TabsTrigger value="profile"><UserRound size={15} />Profile</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="dashboard-panel">
              <div className="dashboard-welcome"><span>YOUR NEXT CHAPTER</span><h3>Where to next?</h3><p>{account.location}</p></div>
              <button className="dashboard-shortlist" onClick={() => setDashboardTab("saved")}><Heart size={21} aria-hidden="true" /><span><strong>{savedPlaces.length} saved {savedPlaces.length === 1 ? "place" : "places"}</strong><small>Saved in this browser</small></span><ArrowRight size={18} aria-hidden="true" /></button>
              <Button asChild className="dashboard-explore"><Link href="/explore" onClick={() => changeOpen(false)}><Compass />Explore destinations<ArrowRight /></Link></Button>
              <Button asChild className="dashboard-explore"><Link href="/together" onClick={() => changeOpen(false)}><UsersRound />Trip Together<ArrowRight /></Link></Button>
            </TabsContent>
            <TabsContent value="saved" className="dashboard-panel">
              <p className="dashboard-note">Saved in this browser, not synced to your account.</p>
              {savedPlaces.length ? <ul className="dashboard-places">{savedPlaces.map((place) => <li key={place.id}><Link href={`/explore?q=${encodeURIComponent(`${place.name}, ${place.country}`)}`} onClick={() => changeOpen(false)}><Image src={place.image} alt={place.alt} width={64} height={64} /><span><strong>{place.name}</strong><small>{place.country}</small></span><ArrowRight size={18} aria-hidden="true" /></Link></li>)}</ul> : <div className="dashboard-empty"><Heart size={30} /><h3>No saved places yet</h3><Button asChild variant="outline"><Link href="/#discover" onClick={() => changeOpen(false)}>Find a place to save<ArrowRight /></Link></Button></div>}
              {savedPlaces.length > 0 && <Link className="dashboard-manage" href="/#discover" onClick={() => changeOpen(false)}>Manage your saved places<ArrowRight size={16} /></Link>}
            </TabsContent>
            <TabsContent value="profile" className="dashboard-panel"><dl className="account-details"><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>WhatsApp</dt><dd>{account.whatsapp}</dd></div><div><dt>Location</dt><dd>{account.location}</dd></div></dl></TabsContent>
          </Tabs>
          {error && <p className="account-error" role="alert">{error}</p>}
          <div className="dashboard-bottom"><span>Signed in</span><Button variant="ghost" disabled={pending} onClick={logout}>{pending ? <LoaderCircle className="animate-spin" /> : <LogOut />}Sign out</Button></div>
        </> : <>
          <Tabs value={mode} onValueChange={(value) => { if (!pending) { setMode(value); setPassword(""); setVisible(false); setError(""); } }}>
            <TabsList className="account-tabs" aria-label="Account access"><TabsTrigger value="login" disabled={pending}>Sign in</TabsTrigger><TabsTrigger value="register" disabled={pending}>Register</TabsTrigger></TabsList>
          </Tabs>
          <form className="account-form" onSubmit={submit} aria-busy={pending}>
            <fieldset disabled={pending}>
              {mode === "register" ? <>
                <label htmlFor="account-email">Email<input id="account-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
                <label htmlFor="account-whatsapp">WhatsApp number<input id="account-whatsapp" name="whatsapp" type="tel" autoComplete="tel" required maxLength={40} value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="+91 98765 43210" aria-describedby="whatsapp-hint" /><small id="whatsapp-hint">Include your country code. Number ownership is not verified.</small></label>
                <label htmlFor="account-location">Location<input id="account-location" name="location" autoComplete="address-level2" required maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, country" /></label>
              </> : <label htmlFor="account-identifier">Email or WhatsApp number<input id="account-identifier" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Email or +country code and number" /></label>}
              <label htmlFor="account-password">Password<span className="account-password"><input id="account-password" name="password" type={visible ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 15 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={mode === "register" ? "password-hint" : undefined} /><button type="button" title={visible ? "Hide password" : "Show password"} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>{mode === "register" && <small id="password-hint">Use 15-128 characters. A longer passphrase works well.</small>}</label>
              {error && <p className="account-error" role="alert">{error}</p>}
              <Button type="submit" className="account-submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}{pending ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}</Button>
            </fieldset>
          </form>
        </>}
      </DialogContent>
    </Dialog>
  );
}