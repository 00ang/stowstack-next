# Your Options

*The real forks in the road. Not a to-do list (that's the next doc) — these are the bigger strategic choices about what to do with what you've built, and the honest trade-offs of each. You don't have to pick just one, but you should pick consciously.*

---

## How to read this

There are two kinds of decisions in front of you:

1. **What's the goal?** (Build a business? Sell the company? Run it as a tool for your own facilities?) — Section A.
2. **Given a goal, which path?** (How to launch, how to grow, how to defend.) — Sections B–E.

Start with A. Everything else depends on it.

---

## A. The big one: what are you actually trying to do here?

The whole codebase is described internally as "acquisition-track." That's a tell. Here are the three honest end-games, with the trade-offs:

### Option A1 — Build a real SaaS business
Sell to independent operators, grow MRR, hire, raise or bootstrap.
- **Upside:** Biggest outcome if it works. You own a category-defining product in a real, painful market.
- **Cost:** It's a years-long grind of sales, support, and feature work. You become a software CEO, not a storage operator. Requires closing all three launch blockers and then a real go-to-market motion.
- **Best if:** You want to go big and you're willing to make this your primary job.

### Option A2 — Build to sell (acquisition-track)
Get to a working platform with real attribution data and a few reference customers, then sell to a strategic buyer (a PMS company, a larger marketing player, even Storable).
- **Upside:** Faster, cleaner exit. Plays to the "raising on a working platform" posture you already have. The sophistication of the build (public API, multi-tenant, white-label) is exactly what acquirers diligence.
- **Cost:** You need *enough* traction to be credible (real customers, real move-in data closing the loop) but not so much that you're running a full company. Timing the sale is an art. And the #1 risk (Storable building this themselves) is also your most likely *buyer* — a double-edged sword.
- **Best if:** You want a defined outcome and you'd rather not run a SaaS company for five years. **My read: this is the most natural fit given how the project is already framed.**

### Option A3 — Run it as your own operator advantage
Use StorageAds to dominate marketing for your own facilities and maybe a few friends, and don't try to make it a company.
- **Upside:** Lowest risk, lowest stress. The thing already mostly works for this. You get the benefit without the burden of being a software vendor.
- **Cost:** You leave the bigger opportunity on the table, and ~125k lines of acquisition-grade code mostly sit idle.
- **Best if:** Your real love is the storage business and this was always meant to be your edge.

**These aren't mutually exclusive in sequence:** the smartest play is often A3 → A2. Use it on your own facilities, generate real move-in data and a case study, *then* decide whether that proof point is worth a company (A1) or a sale (A2). You don't have to choose the end-game today — but you should know which direction you're leaning, because it changes what you build next.

---

## B. The launch path: how do you get the first customers?

### Option B1 — Hand-held design partners first (recommended)
Personally onboard 3–5 operators you know (or from your prospect list). Hand-bill them. Use them to close the move-in loop with real data and produce a case study.
- **Upside:** No need to wire self-serve checkout yet. You learn what actually matters. Real data closes the loop and proves the pitch. This is how almost every serious B2B SaaS starts.
- **Cost:** Doesn't scale — it's manual. But that's the point at this stage.
- **Trade-off vs. B2:** Slower top-line, far higher learning and proof.

### Option B2 — Public self-serve launch
Wire checkout, reconcile pricing, open the doors, drive traffic to the audit tool.
- **Upside:** Scales. Feels like "launching."
- **Cost:** Requires closing *all three* blockers first (move-in loop, checkout/pricing, backups). Premature self-serve with the current gaps would burn early customers and the brand.
- **Best if:** You've already validated with design partners and the blockers are closed.

**The honest sequence is B1 then B2.** Don't open public self-serve until design partners have proven the loop works.

---

## C. The product fork: what do you build next?

You have limited engineering time (you + Angelo). The big choice is *what to finish first.*

### Option C1 — Close the move-in loop (recommended #1 priority)
Connect the existing pieces so a real move-in fires a conversion to Meta (and properly to Google).
- **Why first:** It's the entire differentiator, and for Meta it's mostly connecting things that already exist. Without it, you're selling the same form-fill optimization as everyone else.
- **Cost:** Meta side is small. Google side is a real build (proper offline-conversion import). Call it the highest return-on-effort work available.

### Option C2 — Wire self-serve billing + reconcile pricing
Connect checkout, make website and billing prices agree, enforce subscription status everywhere.
- **Why:** Required for any scaled selling; removes the "charged the wrong amount" risk.
- **Cost:** Modest. But pointless to do *before* C1 if you're going design-partner-first (you can hand-bill).

### Option C3 — Deepen PMS integration (live data feeds)
Move from CSV uploads to live, automatic data from storEDGE (then SiteLink, Yardi).
- **Why:** Live PMS data is what makes the move-in loop automatic and the intelligence real-time. It's also a moat (hard plumbing).
- **Cost:** Significant, and partner-dependent (PMS API access). storEDGE first since the webhook scaffolding exists.

### Option C4 — Harden for scale (backups, staging, security polish)
Confirm backups, add a staging environment, enforce subscriptions, flip security from "watching" to "blocking."
- **Why:** Required before many paying customers depend on you.
- **Cost:** Unglamorous but cheap and fast. Do the data-safety parts before *any* paying customer.

**The natural order:** C1 (loop) → C4's data-safety subset → C2 (billing) → C3 (PMS depth). C3 is the big long-term investment.

---

## D. The go-to-market fork: how do you reach operators?

From the market research, the highest-leverage GTM moves (you can run several):

- **Lead with attribution, not ads.** Don't sound like an agency. Sound like the company that finally measures cost-per-move-in. This is your wedge.
- **Build a public "SpareFoot cost calculator."** Show operators exactly what SpareFoot's per-move-in commissions cost them forever vs. owning their own funnel. A viral-able lead magnet that attacks a hated incumbent.
- **Partner with StoragePug** rather than fighting them — they're an agency, you're software; the move-in data makes their ad-buying look good.
- **Target overbuilt Sun Belt metros first** — Atlanta, Orlando, Phoenix, Tampa, Dallas — operators with 3–15 facilities, on storEDGE/SiteLink, under 85% occupancy. These feel the squeeze most.
- **Add Google LSA management** as an upsell add-on.
- **Go Meta-first** — it's cheap and competitors ignore it.

These aren't either/or; they're a menu you sequence. The calculator + attribution positioning is the cheapest, highest-leverage starting pair.

---

## E. The defense fork: how do you handle the Storable risk?

Storable (the PMS giant) building native attribution is your #1 strategic risk. Three postures:

- **E1 — Outrun them.** Move fast, get the data moat and reference customers before they ship. (Pairs with A1/A2.)
- **E2 — Be un-bundleable.** Stay PMS-agnostic — work with *every* PMS, not just storEDGE — so you're the neutral best-of-breed layer Storable structurally can't be (they'd be favoring their own PMS). This is a real, durable wedge.
- **E3 — Become the acquisition.** If they're going to build it, sell it to them instead. (Pairs with A2.)

Most likely you run E1 + E2 and keep E3 in your back pocket.

---

## Putting it together: the cleanest narrative

If you want one coherent path that most of the above points toward:

> **Lean toward "build to sell" (A2). Start with hand-held design partners (B1). Build the move-in loop first (C1), then lock down data safety, then billing. Position on attribution and ship the SpareFoot calculator (D). Defend by staying PMS-agnostic (E2). Use your own facilities + 3–5 partners to generate the proof, then decide whether that proof is worth a company or a sale.**

That's not the only path — but it's the one with the best ratio of upside to risk given where the product actually is. The next document turns it into a concrete, sequenced 90-day plan.
