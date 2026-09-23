"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountDialog } from "@/components/account-dialog";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Compass, Globe2, Heart, Leaf, LocateFixed, MapPin, Menu, Mountain, MoveUpRight, Pause, Play, Search, Shuffle, Sparkles, Stars, Sun, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { destinations, pilgrimagePlaces, photoCredits, nearestDestination, searchDestinations, type Category, type Destination, type Region } from "@/lib/destinations";

const categories = [
  { value: "all", label: "A bit of everything", icon: Compass },
  { value: "nature", label: "Into the wild", icon: Mountain },
  { value: "culture", label: "Culture & stories", icon: Globe2 },
  { value: "spiritual", label: "Soulful escapes", icon: Sun },
] as const;
const featured = ["jammu", "darjeeling", "varkala", "goa"].map((id) => destinations.find((place) => place.id === id)!);
const footerHotels = [
  { name: "The Taj Mahal Palace", city: "Mumbai" },
  { name: "The Oberoi Udaivilas", city: "Udaipur" },
  { name: "The Leela Palace", city: "Bengaluru" },
];
const storageKey = "yatra-saved-places";

type SearchPlace = { id: string; displayName?: { text: string }; formattedAddress?: string };
const searchLabel = (place: SearchPlace) => [place.displayName?.text, place.formattedAddress].filter(Boolean).join(", ");

function IconTip({ label, children }: { label: string; children: React.ReactElement }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

export function TravelHome() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [region, setRegion] = useState<Region>("all");
  const [category, setCategory] = useState<Category>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestions, setSuggestions] = useState<{ query: string; places: SearchPlace[]; error: string }>({ query: "", places: [], error: "" });
  const [selected, setSelected] = useState<Destination | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [locationPending, setLocationPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [locationNotice, setLocationNotice] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const discoveryRef = useRef<HTMLElement>(null);
  const searchQuery = query.trim();
  const suggestionResults = searchQuery.length >= 2 && suggestions.query === searchQuery ? suggestions.places : [];
  const suggestionsLoading = searchQuery.length >= 2 && suggestions.query !== searchQuery;
  const suggestionError = suggestions.query === searchQuery ? suggestions.error : "";
  const results = searchDestinations(submittedQuery, category, region);
  const displayedResults = showAll ? results : results.slice(0, 4);
  const hero = featured[heroIndex];

  useEffect(() => {
    if (!searchOpen || searchQuery.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/travel/destinations", {
          method: "POST", headers: { "Content-Type": "application/json", "X-Yatra-Request": "1" },
          body: JSON.stringify({ query: searchQuery }), cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Destination suggestions are unavailable. Try again.");
        if (!controller.signal.aborted) setSuggestions({ query: searchQuery, places: data.places, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setSuggestions({ query: searchQuery, places: [], error: error instanceof Error && error.name === "Error" ? error.message : "Destination suggestions are unavailable. Try again." });
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [searchQuery, searchOpen]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(stored)) {
        const valid = stored.filter((id): id is string => typeof id === "string" && destinations.some((place) => place.id === id));
        const frame = requestAnimationFrame(() => setSaved(valid));
        return () => cancelAnimationFrame(frame);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (paused || preference.matches) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) setHeroIndex((current) => (current + 1) % featured.length);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [paused]);

  function toggleSaved(id: string) {
    const next = saved.includes(id) ? saved.filter((place) => place !== id) : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setNotice(next.includes(id) ? "Added to your saved places." : "Removed from your saved places.");
    } catch {
      setNotice("Saved for this visit. Your browser could not store this shortlist.");
    }
  }

  function discover(value = query) {
    if (value.trim().length < 2) { searchRef.current?.focus(); return; }
    router.push(`/explore?q=${encodeURIComponent(value.trim())}`);
  }

  function focusSearch() {
    setMenuOpen(false);
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchRef.current?.focus({ preventScroll: true });
  }

  function showCollection(value: Category) {
    setCategory(value); setQuery(""); setSubmittedQuery(""); setRegion("all"); setShowAll(true);
    discoveryRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function locate() {
    if (!navigator.geolocation) { setLocationNotice("Location is not supported in this browser. Search for a destination instead."); return; }
    setLocationPending(true);
    setLocationNotice("Finding the closest place in our sample collection...");
    navigator.geolocation.getCurrentPosition((position) => {
      const nearest = nearestDestination(position.coords.latitude, position.coords.longitude);
      setLocationPending(false); setRegion("all");
      setLocationNotice(`${nearest.destination.name} is the closest sample destination, approximately ${nearest.distanceKm.toLocaleString()} km away. This is not a live nearby search. Your location is not stored.`);
      discover(nearest.destination.name);
    }, (error) => {
      setLocationPending(false);
      setLocationNotice(error.code === 1 ? "Location permission was declined. You can still search any destination." : "We couldn't get your location. Try a destination name instead.");
    }, { timeout: 10000, maximumAge: 60000 });
  }

  return (
    <div className="yatra-app">
      <a className="skip-link" href="#discover">Skip to destinations</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="wordmark" href="#" aria-label="Yatra home"><span className="brand-icon"><Compass strokeWidth={1.6} /></span>yatra<span className="brand-dot">.</span></a>
          <nav className="desktop-nav" aria-label="Main navigation"><a className="nav-active" href="#discover">Discover</a><a href="#collections">Collections</a><Link href="/together">Trip Together</Link><button onClick={() => setSavedOpen(true)}>Saved places {saved.length > 0 && <span className="saved-count">{saved.length}</span>}</button></nav>
          <div className="header-actions"><span className="worldwide"><Globe2 size={15} /> A world without limits</span><AccountDialog /><Button className="header-cta" aria-label="Let's explore" onClick={focusSearch}><span>Let&apos;s explore</span><ArrowUpRight /></Button><IconTip label="Open navigation"><Button variant="ghost" size="icon" className="mobile-menu" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</Button></IconTip></div>
        </div>
        {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#discover" onClick={() => setMenuOpen(false)}>Discover <ArrowUpRight /></a><a href="#collections" onClick={() => setMenuOpen(false)}>Collections <ArrowUpRight /></a><Link href="/together" onClick={() => setMenuOpen(false)}>Trip Together <ArrowUpRight /></Link><button onClick={() => { setSavedOpen(true); setMenuOpen(false); }}>Saved places <Heart /></button></nav>}
      </header>
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-images" aria-hidden="true">{featured.map((destination, index) => <div key={destination.id} className={`hero-image ${heroIndex === index ? "is-active" : ""} ${paused ? "is-paused" : ""}`}><Image src={destination.image} alt="" fill priority={index === 0} sizes="100vw" quality={90} /></div>)}</div>
          <div className="hero-shade" />
          <div className="shell hero-inner">
            <div className="hero-copy">
              <div className="eyebrow hero-eyebrow"><span className="eyebrow-line" /><Sparkles size={14} /> FOR THE WANDERER IN YOU</div>
              <h1 id="hero-title">Your next<br /><span>Yatra.</span><span className="heading-star" aria-hidden="true"><Stars /></span></h1>
              <p>Somewhere new. Something unforgettable.<br className="desktop-break" /> From close to home to a world away.</p>
              <div className="search-area" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
                <form className="destination-search" onSubmit={(event) => { event.preventDefault(); discover(searchOpen && activeSuggestion >= 0 && suggestionResults[activeSuggestion] ? searchLabel(suggestionResults[activeSuggestion]) : query); }}>
                  <MapPin className="search-pin" size={23} />
                  <div className="search-input-wrap"><label htmlFor="destination-search">Where are you dreaming of?</label><input id="destination-search" ref={searchRef} type="search" value={query} maxLength={160} placeholder="A city, a country, a little escape..." autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={searchOpen} aria-controls={searchOpen ? "destination-options" : undefined} aria-activedescendant={searchOpen && activeSuggestion >= 0 && suggestionResults[activeSuggestion] ? `suggestion-${suggestionResults[activeSuggestion].id}` : undefined} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); setActiveSuggestion(-1); }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setSearchOpen(true); setActiveSuggestion((current) => !suggestionResults.length ? -1 : current < 0 ? (event.key === "ArrowDown" ? 0 : suggestionResults.length - 1) : (current + (event.key === "ArrowDown" ? 1 : -1) + suggestionResults.length) % suggestionResults.length); }
                    if (event.key === "Escape") { setSearchOpen(false); setActiveSuggestion(-1); }
                  }} /></div>
                  <IconTip label="Use my location"><Button type="button" variant="ghost" size="icon" className="locate-button" aria-label="Use my location" disabled={locationPending} onClick={locate}><LocateFixed className={locationPending ? "animate-pulse" : ""} /></Button></IconTip>
                  <Button type="submit" className="search-submit" aria-label="Explore destinations"><Search size={18} /><span>Explore</span></Button>
                </form>
                {searchOpen && <div className="search-suggestions"><div className="suggestion-heading">DESTINATIONS<span>Google Maps</span></div><ul id="destination-options" role="listbox" aria-label="Destination suggestions" aria-busy={suggestionsLoading}>{suggestionResults.map((destination, index) => <li key={destination.id} id={`suggestion-${destination.id}`} role="option" aria-selected={activeSuggestion === index}><button type="button" className={activeSuggestion === index ? "suggestion-active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => discover(searchLabel(destination))}><MapPin size={18} /><span>{destination.displayName?.text || destination.formattedAddress}<small>{destination.formattedAddress}</small></span><ArrowUpRight size={17} /></button></li>)}</ul>{!suggestionResults.length && <p className="suggestion-empty" role="status">{searchQuery.length < 2 ? "Type at least two characters to find a destination." : suggestionsLoading ? "Finding destinations..." : suggestionError || "No destinations found. Try another name."}</p>}</div>}
              </div>
              <div className="search-under"><span>FOLLOW YOUR CURIOSITY</span><button onClick={() => discover("Goa, India")}>Goa <MoveUpRight /></button><button onClick={() => discover("Darjeeling, India")}>Darjeeling <MoveUpRight /></button><button onClick={() => discover("Varkala, India")}>Varkala <MoveUpRight /></button><span className="under-divider" /><button className="surprise-button" onClick={() => setSelected(destinations[Math.floor(Math.random() * destinations.length)])}><Shuffle /> Surprise me</button></div>
              {locationNotice && <p className="location-notice" role="status">{locationNotice}</p>}
            </div>
            <div className="hero-destination"><div className="hero-destination-label"><span className="live-dot" /> A MOMENT IN</div><button onClick={() => setSelected(hero)}>{hero.name}, <span>{hero.country}</span><ArrowUpRight /></button><div className="hero-pagination" aria-label="Featured destinations">{featured.map((destination, index) => <button key={destination.id} className={heroIndex === index ? "active" : ""} aria-label={`Feature ${destination.name}`} aria-pressed={heroIndex === index} onClick={() => { setHeroIndex(index); setPaused(true); }}><span>0{index + 1}</span><i /></button>)}<IconTip label={paused ? "Play destination slideshow" : "Pause destination slideshow"}><button className="pause-control" aria-label={paused ? "Play destination slideshow" : "Pause destination slideshow"} onClick={() => setPaused(!paused)}>{paused ? <Play size={13} /> : <Pause size={13} />}</button></IconTip></div></div>
            <a className="hero-scroll" href="#discover"><ArrowDown size={15} /> A little inspiration, just below</a>
          </div>
          <span className="hero-side-note" aria-hidden="true">LESS ORDINARY. MORE YOU.</span>
        </section>

        <section id="discover" ref={discoveryRef} className="discovery shell" aria-labelledby="discovery-title">
          <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> THE DISCOVERY EDIT</div><h2 id="discovery-title">Somewhere that feels <span>like you.</span></h2></div><p>Big adventures. Quiet corners.<br />Find what moves you.</p></div>
          <Tabs value={category} onValueChange={(value) => { setCategory(value as Category); setShowAll(true); }}>
            <div className="discovery-controls"><TabsList className="category-tabs" aria-label="Destination interests">{categories.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value}><Icon size={16} />{label}</TabsTrigger>)}</TabsList><label className="region-select"><Globe2 size={15} /><span className="sr-only">Destination region</span><select value={region} onChange={(event) => { setRegion(event.target.value as Region); setShowAll(true); }}><option value="all">All destinations</option><option value="india">India</option><option value="international">Beyond India</option></select></label></div>
            {submittedQuery && <div className="result-summary" role="status"><span>{results.length} {results.length === 1 ? "destination" : "destinations"} for <strong>&ldquo;{submittedQuery}&rdquo;</strong></span><button onClick={() => { setQuery(""); setSubmittedQuery(""); }}>Clear search <X size={14} /></button></div>}
            {categories.map(({ value }) => <TabsContent key={value} value={value}>{displayedResults.length > 0 ? <div className="destination-grid">{displayedResults.map((destination, index) => <article className="destination-card" key={destination.id} style={{ animationDelay: `${index * 65}ms` }}>
              <button className="card-open" onClick={() => setSelected(destination)} aria-label={`Explore ${destination.name}, ${destination.country}`}><div className="card-image"><Image src={destination.image} alt={destination.alt} fill sizes="(max-width: 640px) 45vw, (max-width: 1000px) 45vw, 24vw" /><span className="card-image-shade" /><span className="card-country"><MapPin size={12} />{destination.country}</span><span className="card-explore"><ArrowUpRight size={19} /></span></div><div className="card-caption"><div><h3>{destination.name}</h3><p>{destination.mood}</p></div><span className="card-dot" style={{ background: destination.accent }} /></div></button>
              <IconTip label={saved.includes(destination.id) ? `Unsave ${destination.name}` : `Save ${destination.name}`}><button className={`save-button ${saved.includes(destination.id) ? "is-saved" : ""}`} aria-label={saved.includes(destination.id) ? `Unsave ${destination.name}` : `Save ${destination.name}`} aria-pressed={saved.includes(destination.id)} onClick={() => toggleSaved(destination.id)}><Heart size={17} fill={saved.includes(destination.id) ? "currentColor" : "none"} /></button></IconTip>
            </article>)}</div> : <div className="empty-state"><Compass size={35} /><h3>A little off our current map.</h3><p>No matches in this sample collection. Try another place or reset your filters.</p><Button onClick={() => showCollection("all")}>Explore all destinations <ArrowRight /></Button></div>}</TabsContent>)}
          </Tabs>
          <div className="discovery-footer"><span><span className="sample-dot" /> Curated sample collection. Not live travel data.</span>{!showAll && results.length > 4 ? <button onClick={() => setShowAll(true)}>See all destinations <ArrowRight size={16} /></button> : <span>{results.length} {results.length === 1 ? "place" : "places"} to get you dreaming</span>}</div>
        </section>

        <section className="collection-section shell" id="collections" aria-labelledby="collection-title">
          <div className="collection-intro"><div className="eyebrow"><span className="eyebrow-line" /> NOT ALL WHO WANDER</div><h2 id="collection-title">Different moods.<br /><span>Endless possibilities.</span></h2><p>Chase a feeling, not a checklist.<br />There&apos;s a journey for every version of you.</p><button onClick={() => showCollection("all")}>Find your kind of journey <ArrowUpRight size={19} /></button></div>
          <button className="collection-tile" onClick={() => showCollection("nature")}><Image src="/images/varkala.jpg" alt="Varkala beach beneath Kerala's coastal cliffs" fill sizes="(max-width: 640px) 90vw, 33vw" /><span className="collection-shade" /><span className="collection-tile-top"><Leaf size={22} /><ArrowUpRight size={22} /></span><span className="collection-tile-copy"><small>FOR A BREATH OF FRESH AIR</small><strong>Coastlines.<br />Fresh perspectives.</strong><span>Nature & slow escapes <ArrowRight size={16} /></span></span></button>
          <a className="collection-tile" href="#pilgrimage"><Image src="/images/golden-temple.jpg" alt="Golden Temple in Amritsar" fill sizes="(max-width: 640px) 90vw, 33vw" /><span className="collection-shade" /><span className="collection-tile-top"><Sun size={22} /><ArrowUpRight size={22} /></span><span className="collection-tile-copy"><small>FOR A LITTLE INNER PEACE</small><strong>Places with<br />a soul.</strong><span>Pilgrimage & sacred journeys <ArrowRight size={16} /></span></span></a>
        </section>
        <section className="pilgrimage-section shell" id="pilgrimage" aria-labelledby="pilgrimage-title">
          <div className="section-heading"><div><div className="eyebrow"><Sun size={15} /> SACRED JOURNEYS</div><h2 id="pilgrimage-title">A journey of <span>faith.</span></h2></div><Button variant="outline" onClick={focusSearch}><Search size={16} /> Search more places</Button></div>
          <div className="pilgrimage-grid">{pilgrimagePlaces.map((place) => <article className="destination-card" key={place.id}><button className="card-open" onClick={() => discover(place.query)} aria-label={`Explore ${place.name}`}><div className="card-image"><Image src={place.image} alt={place.alt} fill sizes="(max-width: 640px) 44vw, (max-width: 1000px) 30vw, 16vw" /><span className="card-image-shade" /><span className="card-explore"><ArrowUpRight size={18} /></span></div><div className="card-caption"><div><h3>{place.name}</h3><p>{place.location}</p></div></div></button></article>)}</div>
        </section>
        <section className="closing-band"><div className="shell closing-inner"><div><Sparkles size={23} /><p>Your next favourite place<br /><strong>is still out there.</strong></p></div><Button onClick={focusSearch}>Go find it <ArrowUpRight /></Button><span className="closing-coordinate" aria-hidden="true"><Waves size={38} /></span></div></section>
      </main>
      <footer className="site-footer">
        <div className="shell">
          <div className="footer-main">
            <div className="footer-brand">
              <a className="wordmark" href="#" aria-label="Yatra home"><span className="brand-icon"><Compass strokeWidth={1.6} /></span>yatra<span className="brand-dot">.</span></a>
              <p>Near to home.<br />Far from ordinary.</p>
              <span className="footer-world"><Globe2 size={16} aria-hidden="true" /> India & beyond</span>
              <button className="footer-saved" onClick={() => setSavedOpen(true)}><Heart size={15} aria-hidden="true" /> Your saved places <ArrowUpRight size={15} aria-hidden="true" /></button>
            </div>
            <nav className="footer-column" aria-labelledby="footer-destinations">
              <h2 id="footer-destinations">Places to wander</h2>
              <ul>{featured.map((place) => <li key={place.id}><a href={`/explore?q=${encodeURIComponent(`${place.name}, ${place.country}`)}`}>{place.name}<ArrowUpRight size={14} aria-hidden="true" /></a></li>)}</ul>
              <a className="footer-more" href="/explore">Explore the world <ArrowRight size={15} aria-hidden="true" /></a>
            </nav>
            <nav className="footer-column footer-hotels" aria-labelledby="footer-hotels">
              <h2 id="footer-hotels">Hotels to discover</h2>
              <ul>{footerHotels.map((hotel) => <li key={hotel.name}><a href={`/explore?q=${encodeURIComponent(`${hotel.name}, ${hotel.city}, India`)}`}><span>{hotel.name}<small>{hotel.city}</small></span><ArrowUpRight size={14} aria-hidden="true" /></a></li>)}</ul>
            </nav>
            <nav className="footer-column" aria-labelledby="footer-pilgrimage">
              <h2 id="footer-pilgrimage">Sacred journeys</h2>
              <ul>{pilgrimagePlaces.map((place) => <li key={place.id}><a href={`/explore?q=${encodeURIComponent(place.query)}`}>{place.name}<ArrowUpRight size={14} aria-hidden="true" /></a></li>)}</ul>
            </nav>
          </div>
          <div className="footer-bottom"><span>Made for the wonderfully curious.</span><div><button onClick={() => setCreditsOpen(true)}>Photo credits</button><a href="#">Back to top <ArrowUpRight size={14} aria-hidden="true" /></a></div></div>
        </div>
      </footer>
      <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}><DialogContent className="saved-dialog"><DialogHeader><DialogTitle>Photo credits</DialogTitle><DialogDescription>Indian destination photographs from Wikimedia Commons. Images are resized and cropped for display; original licences apply.</DialogDescription></DialogHeader><ul className="photo-credits">{photoCredits.map((photo) => <li key={photo.file}><a href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.file)}`} target="_blank" rel="noreferrer">{photo.name}</a><span>{photo.author}</span><a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></li>)}</ul></DialogContent></Dialog>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="destination-dialog">{selected && <><div className="dialog-photo"><Image src={selected.image} alt={selected.alt} fill sizes="(max-width: 640px) 95vw, 620px" /><span className="dialog-photo-shade" /></div><div className="dialog-body"><DialogHeader><span className="eyebrow"><MapPin size={14} />{selected.country}</span><DialogTitle>{selected.name}</DialogTitle><DialogDescription>{selected.description}</DialogDescription></DialogHeader><h3>A few places to begin</h3><ul className="place-list">{selected.places.map((place) => <li key={place}><MapPin size={15} />{place}</li>)}</ul><p className="data-disclaimer">Sample destination guide, not live place information. Check official sources for current opening hours, entry rules, and travel conditions.</p><div className="dialog-actions"><Button onClick={() => discover(`${selected.name}, ${selected.country}`)}>Explore nearby <ArrowUpRight /></Button><Button variant="outline" onClick={() => toggleSaved(selected.id)}>{saved.includes(selected.id) ? <Check /> : <Heart />}{saved.includes(selected.id) ? "Saved to your places" : "Save this place"}</Button></div></div></>}</DialogContent></Dialog>
      <Dialog open={savedOpen} onOpenChange={setSavedOpen}><DialogContent className="saved-dialog"><DialogHeader><span className="eyebrow"><Heart size={16} /> YOUR LITTLE WISHLIST</span><DialogTitle>Places for someday.</DialogTitle><DialogDescription>Your shortlist is saved in this browser.</DialogDescription></DialogHeader>{saved.length ? <div className="saved-list">{destinations.filter((destination) => saved.includes(destination.id)).map((destination) => <div className="saved-row" key={destination.id}><button onClick={() => { setSavedOpen(false); setSelected(destination); }}><Image src={destination.image} alt={destination.alt} width={64} height={64} /><span>{destination.name}<small>{destination.country}</small></span></button><IconTip label={`Remove ${destination.name}`}><Button variant="ghost" size="icon" aria-label={`Remove ${destination.name}`} onClick={() => toggleSaved(destination.id)}><X /></Button></IconTip></div>)}</div> : <div className="saved-empty"><Heart size={35} /><p>Your next favourite place is waiting.</p><Button onClick={() => { setSavedOpen(false); discoveryRef.current?.scrollIntoView({ behavior: "smooth" }); }}>Explore destinations <ArrowRight /></Button></div>}</DialogContent></Dialog>
      {notice && <div className="notification" role="status"><Check size={17} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}
    </div>
  );
}