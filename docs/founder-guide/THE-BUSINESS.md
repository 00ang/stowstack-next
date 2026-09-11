# The Business

*What StorageAds is as a business — the problem, the customer, the money, the market, the competition, and the moat. Written so you could pitch it from memory.*

---

## The problem you're solving

For twenty years, self-storage operators have measured their marketing the same way: **cost per lead.** How much did it cost to get someone to fill out a form or call?

But a lead isn't money. A lead is a maybe. The number that actually pays the mortgage is **cost per move-in** — how much did it cost to get someone to sign a lease and physically move their stuff in?

Nobody connects those two numbers, because it's genuinely hard. The lead happens on the ad platform (Meta, Google). The move-in happens days or weeks later, inside the facility's property-management software, in a totally separate system. Bridging that gap requires landing pages, call tracking, lead-matching, and a live connection into the facility's books — a lot of plumbing.

So operators fly blind. They know they spent $3,000 on Google ads and got 40 leads. They have no idea that 35 of those leads were tire-kickers and the 5 real move-ins came from a Meta campaign they almost turned off.

**StorageAds' pitch:** *"Self-storage marketing has been measuring the wrong thing for twenty years. The right thing is cost per move-in — and we're the operator-built platform that finally measures it."* The whitepaper's tagline: **"Plug it in. Fill the units."**

---

## Who the customer is

**The target:** Independent self-storage operators and small portfolios — roughly **1 to 50 facilities.** Also management companies who want to white-label the platform for the facilities they run.

**Explicitly NOT the target:**
- The 5 big REITs (Public Storage, Extra Space, CubeSmart, Life Storage, NSA) — they have in-house marketing teams and won't buy.
- Mega-operators with 500+ facilities — the platform isn't sized for that, and they build their own.

This leaves the **~40,000 independent and small-portfolio facilities** in the US as the addressable market (out of ~60,000 total; the REITs own ~35%).

**Why these customers, specifically:** They're getting squeezed. Per the market research (dated March 2026): national occupancy is down to ~77%, move-in rates dropped ~10.7% year-over-year, Google ad costs are up ~45%, and the REITs are spending $34M+/year on marketing — outgunning the little guy. The independent operator feels the pain and has no good answer. That's your opening.

---

## How the money works

**The model:** Per-facility, per-month subscription. One bill per facility. Four tiers.

**Founding / alpha pricing** (this is the canonical, current pricing — confirmed live on storageads.com; note prices roughly **double** after alpha, and lock for 12 months if a customer signs during alpha):

| Tier | Price (per facility/mo) | Who it's for |
|------|------------------------|--------------|
| **Signal** | **$299** | The cheapest way to find out if paid ads work at your facility. 1 facility, ads + a custom site. Month-to-month. |
| **System** | **$749** | The full thing — everything connected, custom site with storEDGE embed. Independent operators with 1–4 facilities who want the whole machine without hiring an agency. (6-month commit because the site build is included.) |
| **Compound** | **$1,249** | For facilities where every move-in is worth $2,400+. Everything in System plus a named strategist, audience sync, churn predictions, Google Business Profile, priority creative. Month-to-month. |
| **Enterprise** | Custom | 10+ facilities, white-label, dedicated team. Volume pricing: $599/facility at 10–24, $499 at 25–49, $449 at 50+. |

**Plus a $1,000/month ad-spend minimum per facility** — but this is critical: **that money goes directly to Meta and Google, not to you.** You don't mark it up, you don't touch it. The operator sees exactly what they spent.

**Why the ad-spend floor exists** (and why it's not a money grab): below ~$1,000/mo, paid ad campaigns can't gather enough data to optimize. You'd be charging someone to run a campaign that can't improve. The floor is the line below which the channel simply doesn't work.

**Why you don't touch ad spend** (a deliberate strategic choice): the moment you mark up ad spend, you look like an agency. Agencies are a category customers distrust and where you "rent, don't own." Staying out of the ad-spend markup keeps you positioned as *software the operator owns*, not *an agency they hire*.

**Other revenue lines built into the platform:**
- **Partner / white-label revenue share** — resellers earn a configurable percentage of the monthly revenue on facilities they refer or operate. The whole rev-share system is built into the database.
- **The free audit tool** is not revenue — it's the top of the funnel that feeds everything.

---

## The market and where you sit in it

**Market size:** ~60,000 US self-storage facilities. ~35% owned by 5 REITs. Your addressable market is the ~40,000 independents and small portfolios.

**The competitive landscape** — there are five categories of competition, and you beat each on a different axis:

| Competitor type | Examples | Their weakness vs. you |
|-----------------|----------|------------------------|
| **PMS marketing modules** | Storable's marketing add-on (they run storEDGE/SiteLink, and own SpareFoot) | Bundled to their PMS; not best-of-breed. **But this is your #1 strategic risk** — see below. |
| **Marketing agencies** | StoragePug, G5, StorageRankers | You rent, don't own; mostly Google-only; markup on ad spend. (StoragePug is better seen as a *partner* than a competitor.) |
| **DIY** | Google Ads + a spreadsheet | No attribution at all. The status quo you're replacing. |
| **Generalist attribution** | Triple Whale, Northbeam | Built for e-commerce; they don't understand "move-in." |
| **Pricing-intelligence tools** | Adverank (SSA-backed) | They optimize rates, they don't *generate demand*. Flagged as the most dangerous *emerging* competitor. |

**Your stated moats** (the things that are hard to copy):
1. **Operator credibility.** Built by a real storage operator (you), not a marketing agency. This can't be faked, and it's the core of the brand. "Operator-built, not marketer-built."
2. **The full attribution chain.** Landing pages + the embed in the facility's PMS + UTM tracking + call tracking, all connected. Technically hard to replicate — it's a lot of plumbing.
3. **Compounding data.** The longer it runs, the more move-in data it has, the better it gets — a flywheel a new entrant can't instantly match.

**The strategic edge worth underlining:** Meta is wildly under-used in storage. Fewer than 5% of independent operators run Meta ads, and Meta clicks cost ~$1–4 vs. Google's ~$6–40. StorageAds is built **Meta-first** — which means cheaper leads in a channel competitors ignore.

**Your #1 strategic risk:** **Storable** (the PMS giant that already sits inside many of these facilities) deciding to build native move-in attribution into their product. They have the PMS relationship and the distribution. The market research flags this as the top risk. Your defenses: move faster, be best-of-breed and PMS-agnostic (work with *every* PMS, not just one), and build the compounding-data moat before they wake up.

---

## Who's building it

- **Blake** (you) — founder. A real self-storage operator. You own product and sales, and you *are* the credibility moat.
- **Angelo** — co-founder, engineer. Built the ad-platform integrations and the AI image/video generation studio.

Two people. ~125,000 lines of code. ~6 weeks. That story itself is part of the pitch — especially the funding posture below.

---

## The funding posture

From the docs: **"Not raising on a deck. Raising on a working platform."** And internally, the codebase is treated as **acquisition-track** — "treat every commit like it's going into due diligence." The strategy isn't to pitch a slide deck of promises; it's to show a working, sophisticated platform with real attribution data and let that do the talking. That's a strong position *if* the platform genuinely delivers the core promise — which brings us to the honest status in the next document.

---

## The business in five sentences

StorageAds sells software that runs an independent storage operator's entire marketing machine and proves which ad dollars produced real move-ins — the number the industry has ignored for twenty years. It charges $299–$1,249 per facility per month (founding prices), keeps its hands off ad spend to stay "software, not an agency," and targets the ~40,000 independents being squeezed by the REITs. Its moat is operator credibility plus a hard-to-copy attribution chain plus compounding data. Its biggest risk is Storable building the same thing from inside the PMS they already own. It wins by being faster, PMS-agnostic, and Meta-first in a channel competitors ignore.
