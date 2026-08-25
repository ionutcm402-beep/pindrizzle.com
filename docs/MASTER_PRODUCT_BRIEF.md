# Ping — Master Product Brief v1.0

Status: **LOCKED BASELINE**

## Mission

Make the immediate world around you useful again.

## Core promise

**Know what's happening in your mile.**

Ping is a real-time hyper-local community network focused on useful nearby information rather than followers or global content.

## Product rules

Every major feature must improve at least one of:

1. Usefulness
2. Trust
3. Return usage

If it improves none of these, it should not be built.

## Core loop

Open Ping → location detected → see nearby activity → open a Ping → respond, help, navigate or confirm.

Posting: + Ping → choose category → describe → optional photo → confirm approximate location → publish.

## Primary navigation

- Feed
- Map
- + Ping
- Alerts
- You

## Initial categories

- Alerts
- Lost & Found
- Free Stuff
- Help
- Traffic
- Local News
- Pets
- Safety
- Events
- Roadworks

## Freshness

Most ordinary Pings expire after 24 hours. Expiry should later adapt by category.

## Trust

Initial trust actions:

- Confirm
- Helpful
- Comment
- Report
- Block

No follower economy. No influencer mechanics. Reputation should reflect useful local contribution.

## Location

Marketing starts with a 1-mile promise, but the architecture must support configurable radii such as 0.5, 1, 3 and 5 miles.

## Privacy

Exact event locations may be shown where useful. Personal/home-related posts should support approximate location. Never expose a user's home coordinates as profile data.

## Retention

Return loops must be useful rather than manipulative:

- meaningful nearby alerts
- what changed since last visit
- replies
- followed Ping resolution
- unusually active nearby area

## Empty-area strategy

A quiet area must not feel broken. Use honest quiet-state messaging and useful local modules rather than fake activity.

## Technical direction

- Next.js + React + TypeScript
- Vercel
- Supabase Auth
- PostgreSQL + PostGIS
- Supabase Realtime
- Supabase Storage
- Map provider to be selected after cost/fit review

## Monetisation direction

Do not charge ordinary users at launch. Longer-term candidates:

- promoted local Pings
- verified business profiles
- local offers
- featured events

Monetisation must not damage usefulness or trust.

## Launch strategy

Launch in one concentrated geography first. Density is more important than geographic reach.

## Build phases

0. Foundation
1. Interface shell
2. Real accounts + location
3. Real Pings
4. Map
5. Community
6. Realtime + notifications
7. Trust & safety
8. Retention
9. Monetisation foundation
10. Launch hardening

## North Star

**Does this make Ping more useful for discovering what matters around me right now?**
