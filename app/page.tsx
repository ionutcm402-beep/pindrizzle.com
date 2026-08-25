"use client";

import { useMemo, useState } from "react";

type Tab = "feed" | "map" | "alerts" | "you";
type Category = "Alert" | "Traffic" | "Lost & Found" | "Free" | "Help" | "Local";

type PingItem = {
  id: number;
  category: Category;
  emoji: string;
  title: string;
  body: string;
  distance: string;
  age: string;
  confirmations: number;
  place: string;
  tone: "urgent" | "warm" | "neutral" | "helpful";
};

const pings: PingItem[] = [
  {
    id: 1,
    category: "Traffic",
    emoji: "🚧",
    title: "One lane blocked near the roundabout",
    body: "A delivery van has stopped across the left lane. Traffic is moving, but slowly.",
    distance: "0.2 mi",
    age: "4 min",
    confirmations: 8,
    place: "Three Bridges",
    tone: "urgent",
  },
  {
    id: 2,
    category: "Lost & Found",
    emoji: "🐕",
    title: "Has anyone seen Milo?",
    body: "Small brown spaniel, red collar. Last seen near the park entrance about 20 minutes ago.",
    distance: "0.5 mi",
    age: "18 min",
    confirmations: 3,
    place: "Maidenbower Park",
    tone: "warm",
  },
  {
    id: 3,
    category: "Free",
    emoji: "🎁",
    title: "Free toddler bike — collection today",
    body: "Still works well, just outgrown. Happy for it to go to someone nearby who can use it.",
    distance: "0.7 mi",
    age: "31 min",
    confirmations: 5,
    place: "Worth Road",
    tone: "helpful",
  },
  {
    id: 4,
    category: "Local",
    emoji: "☕",
    title: "Quiet tables available right now",
    body: "The café by the station is unusually quiet if anyone needs somewhere to work for an hour.",
    distance: "0.4 mi",
    age: "42 min",
    confirmations: 2,
    place: "Three Bridges Station",
    tone: "neutral",
  },
];

const filters = ["All", "Alerts", "Traffic", "Lost & Found", "Free", "Help"];

function FeedCard({ ping }: { ping: PingItem }) {
  return (
    <article className={`ping-card tone-${ping.tone}`}>
      <div className="ping-card-topline">
        <div className="category-badge"><span>{ping.emoji}</span>{ping.category}</div>
        <button className="icon-button" aria-label="More options">•••</button>
      </div>
      <h2>{ping.title}</h2>
      <p className="ping-body">{ping.body}</p>
      <div className="ping-place">📍 {ping.place}</div>
      <div className="ping-meta">
        <span><strong>{ping.distance}</strong> away</span>
        <span>{ping.age} ago</span>
      </div>
      <div className="ping-actions">
        <button>✓ {ping.confirmations} confirmed</button>
        <button>💬 Reply</button>
        <button>↗ Share</button>
      </div>
    </article>
  );
}

function FeedView() {
  const [filter, setFilter] = useState("All");
  const visible = useMemo(() => {
    if (filter === "All") return pings;
    if (filter === "Alerts") return pings.filter((p) => p.category === "Alert" || p.category === "Traffic");
    return pings.filter((p) => p.category === filter);
  }, [filter]);

  return (
    <>
      <header className="app-header">
        <div>
          <div className="brand">ping<span>.</span></div>
          <button className="location-pill">● Your mile · Three Bridges <span>⌄</span></button>
        </div>
        <button className="round-action" aria-label="Search">⌕</button>
      </header>

      <section className="hero-strip">
        <div>
          <span className="live-dot" />
          <strong>12 new nearby</strong>
        </div>
        <p>Here’s what changed around you.</p>
      </section>

      <div className="filter-row" aria-label="Feed filters">
        {filters.map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>

      <main className="feed-list">
        {visible.length ? visible.map((ping) => <FeedCard key={ping.id} ping={ping} />) : (
          <div className="quiet-card">
            <div className="quiet-icon">☀️</div>
            <h2>Quiet around here.</h2>
            <p>Nothing important has been reported in this category nearby. That’s usually good news.</p>
          </div>
        )}
      </main>
    </>
  );
}

function MapView() {
  return (
    <div className="map-view">
      <header className="floating-map-header">
        <div>
          <div className="brand small">ping<span>.</span></div>
          <div className="map-location">Your mile</div>
        </div>
        <button className="round-action">⌕</button>
      </header>
      <div className="map-canvas" aria-label="Demo map">
        <div className="road road-one" />
        <div className="road road-two" />
        <div className="road road-three" />
        <div className="park">PARK</div>
        <div className="radius-ring" />
        <div className="you-dot"><span>YOU</span></div>
        <button className="map-pin pin-a">🚧</button>
        <button className="map-pin pin-b">🐕</button>
        <button className="map-pin pin-c">🎁</button>
        <button className="map-pin pin-d">☕</button>
      </div>
      <div className="map-bottom-card">
        <div className="category-badge"><span>🚧</span>Traffic</div>
        <h2>One lane blocked near the roundabout</h2>
        <p><strong>0.2 mi</strong> away · 4 min ago · 8 confirmed</p>
      </div>
    </div>
  );
}

function AlertsView() {
  return (
    <div className="simple-screen">
      <header className="simple-header"><div><div className="brand small">ping<span>.</span></div><h1>Alerts</h1></div></header>
      <div className="notice-card important"><span>🚨</span><div><strong>Traffic nearby</strong><p>One lane blocked 0.2 miles away · 4 min ago</p></div></div>
      <div className="notice-card"><span>💬</span><div><strong>Someone replied to your Ping</strong><p>“I can bring it round after 6.” · 14 min ago</p></div></div>
      <div className="notice-card"><span>✓</span><div><strong>Your neighbourhood helped</strong><p>A lost pet Ping you followed was marked resolved.</p></div></div>
      <div className="notification-rule"><strong>Useful notifications only.</strong><p>Ping won’t send “we miss you” messages. Alerts are reserved for things that actually matter near you.</p></div>
    </div>
  );
}

function YouView() {
  return (
    <div className="simple-screen">
      <header className="simple-header"><div><div className="brand small">ping<span>.</span></div><h1>You</h1></div></header>
      <div className="profile-card">
        <div className="avatar">IC</div>
        <div><h2>Your local profile</h2><p>Three Bridges · joined this week</p></div>
      </div>
      <div className="trust-row"><div><strong>7</strong><span>Helpful Pings</span></div><div><strong>19</strong><span>Confirmations</span></div><div><strong>1 mi</strong><span>Your radius</span></div></div>
      <div className="settings-list">
        <button><span>📍</span><div><strong>Location & radius</strong><small>1 mile · approximate home location</small></div><b>›</b></button>
        <button><span>🔔</span><div><strong>Notifications</strong><small>Important nearby activity only</small></div><b>›</b></button>
        <button><span>🛡️</span><div><strong>Privacy & safety</strong><small>Blocked users, reports, location privacy</small></div><b>›</b></button>
      </div>
    </div>
  );
}

function Composer({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState("Alert");
  return (
    <div className="composer-backdrop" role="dialog" aria-modal="true" aria-label="Create a Ping">
      <div className="composer-sheet">
        <div className="sheet-handle" />
        <div className="composer-header"><button onClick={onClose}>Cancel</button><strong>New Ping</strong><span /></div>
        <h2>What’s happening?</h2>
        <div className="category-grid">
          {["🚨 Alert", "🚧 Traffic", "🐕 Lost & Found", "🎁 Free", "🙋 Help", "📍 Local"].map((item) => (
            <button key={item} className={category === item.split(" ").slice(1).join(" ") ? "selected" : ""} onClick={() => setCategory(item.split(" ").slice(1).join(" "))}>{item}</button>
          ))}
        </div>
        <label className="composer-label">Tell your neighbours what they need to know</label>
        <textarea placeholder="Keep it clear and useful…" maxLength={280} />
        <div className="composer-options">
          <button>📷 Add photo</button>
          <button>📍 Near your current location</button>
        </div>
        <div className="expiry-note">⏱ This Ping will disappear automatically after 24 hours.</div>
        <button className="publish-button">Ping it</button>
      </div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("feed");
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="page-shell">
      <div className="app-shell">
        <div className="screen-content">
          {tab === "feed" && <FeedView />}
          {tab === "map" && <MapView />}
          {tab === "alerts" && <AlertsView />}
          {tab === "you" && <YouView />}
        </div>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <button className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}><span>⌂</span>Feed</button>
          <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><span>⌖</span>Map</button>
          <button className="compose-nav" onClick={() => setComposerOpen(true)} aria-label="Create a Ping"><span>+</span>Ping</button>
          <button className={tab === "alerts" ? "active" : ""} onClick={() => setTab("alerts")}><span>♢</span>Alerts<i>2</i></button>
          <button className={tab === "you" ? "active" : ""} onClick={() => setTab("you")}><span>○</span>You</button>
        </nav>
      </div>
      {composerOpen && <Composer onClose={() => setComposerOpen(false)} />}
    </div>
  );
}
