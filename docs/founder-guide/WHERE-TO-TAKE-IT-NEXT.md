# Where To Take It Next

*The recommendation, not the menu. If I were in your seat, here's what I'd do, in this order, and why. A concrete ~90-day plan that turns "we built a lot" into "we proved the thing works and we know what it's worth."*

---

## The strategy in one paragraph

You've built ~90% of a genuinely impressive product. The missing 10% includes the exact feature that makes the whole pitch true (the move-in loop). So the entire near-term game is: **close that loop, prove it works on real facilities, and generate one undeniable case study — then let that proof decide whether you're building a company or selling one.** Everything below serves that goal. Don't get distracted by the breadth of features that already exist; the value is unlocked by finishing the *one* that matters and putting it in front of real operators.

**Guiding principle:** finish, don't expand. You have more features than you have proof. The next 90 days add zero new surface area and instead make the existing surface real.

---

## Phase 0 — This week: protect what you have (1–2 days)

Before anything else, remove the ways you could lose data or get embarrassed. These are cheap and they're insurance.

1. **Confirm database backups are on.** Log into Neon, verify point-in-time recovery is enabled on the *production* database, note the recovery window, and do one test restore to a scratch database. Write a half-page "how to restore" note. *(Right now nothing proves backups exist — this is the single scariest gap.)*
2. **Stop hand-editing production blind.** Until there's a real migration process, make a rule: never run a database schema change against production without (a) a fresh backup checkpoint and (b) eyeballing the diff. One sentence in your head, big downside avoided.
3. **Wire the safety guard into CI.** The script that blocks the dangerous auto-migration exists but doesn't run automatically on every change. Make it run. (Angelo: add `lint:safety` to the CI workflow.)

**Done when:** you could lose your laptop and your database and recover both.

---

## Phase 1 — Weeks 1–3: close the move-in loop on Meta

This is the whole ballgame. The pieces exist; connect them.

1. **Fire a real move-in conversion to Meta.** When the lead-to-tenant matcher finds that a captured lead actually moved in, send a *move-in* (Purchase) event to Meta's Conversions API — not the form-fill (Lead) event it sends today. The matcher, the sender, and the move-in webhook all already exist; this is connecting them and changing which event fires.
2. **Trigger it from the move-in, not the form.** The storEDGE webhook fires on a completed move-in but currently only logs. Make that the trigger that runs the matcher and fires the conversion.
3. **Prove it end-to-end on your own facility.** Use your own facility as customer zero. Run a small Meta campaign, capture a lead, move someone in, and watch the move-in event land in Meta's Events Manager. *Seeing that fire is the moment the company becomes real.*

**Why Meta first and not Google:** the Meta path is nearly wired already; the Google path needs a proper "offline conversion import" built from scratch (the current Google code uses the wrong, legacy mechanism). Get the win on Meta, then schedule the Google build as a follow-on — and remember Meta is your strategic channel anyway (cheap, ignored by competitors).

**Done when:** a real move-in at your own facility automatically shows up as a conversion in Meta, and Meta's optimizer starts chasing move-ins instead of form-fills. **This is the most important milestone in the entire plan.**

---

## Phase 2 — Weeks 2–5: get 3–5 design partners (overlaps Phase 1)

Don't wait for perfection. Start the sales motion while the loop is being finished.

1. **Pick 3–5 operators** from your ~100-prospect seed list — ideally on storEDGE, 3–15 facilities, in a squeezed Sun Belt metro (Atlanta, Orlando, Phoenix, Tampa, Dallas), under 85% occupancy.
2. **Sell them by hand.** Use the free audit tool as the opener (it's built and it's good), then a call. Hand-bill them — a manual Stripe subscription or invoice. *Do not* spend time wiring self-serve checkout yet; you want these conversations anyway.
3. **Lead with attribution, not ads.** "We measure cost-per-move-in, the number you've never been able to see." Don't sound like an agency.
4. **Onboard them onto the now-working loop** as it lands from Phase 1.

**Done when:** 3–5 real operators are live, paying (even if hand-billed), and generating move-in data.

---

## Phase 3 — Weeks 4–8: make money safe to take, then turn it on

Once the loop works and partners are live, harden the money path.

1. **Reconcile pricing — one source of truth.** Make the billing code, the Stripe products, and the website all say Signal $299 / System $749 / Compound $1,249. Today they disagree, which risks charging the wrong amount. *(See [DECISIONS-AND-CONTRADICTIONS.md](./DECISIONS-AND-CONTRADICTIONS.md) — this is decided; it just needs doing in code.)*
2. **Wire the "Subscribe" button.** Connect the pricing-page buttons to the (already-built, already-tested) checkout. Now you can take money without a manual step.
3. **Enforce subscriptions everywhere.** Make a canceled/past-due customer actually lose access — today they only lose the ability to add a facility.
4. **Provision Twilio.** Switch on the account so call tracking and SMS actually flow. The code is ready.

**Done when:** a stranger could subscribe on the website and be charged the right amount, and call tracking works.

---

## Phase 4 — Weeks 6–12: the proof, then the decision

This is where it pays off.

1. **Build the case study.** Take your best design partner (or your own facility), and produce one undeniable story: "Spent $X, drove Y move-ins, at $Z cost-per-move-in — a number they could never see before." This single artifact is worth more than any feature.
2. **Ship the SpareFoot cost calculator** — a public tool showing operators what SpareFoot's per-move-in commissions cost them forever vs. owning their funnel. Cheap to build, attacks a hated incumbent, generates leads.
3. **Build the Google side of the loop** (proper offline-conversion import) now that Meta is proven — this rounds out the "we close the loop on *both* platforms" claim.
4. **Then decide the end-game.** With a working loop, paying partners, and a real case study in hand, you'll finally have the information to choose between A1 (build the company), A2 (build to sell), or A3 (keep it as your own edge) — see [YOUR-OPTIONS.md](./YOUR-OPTIONS.md). *Don't make this decision now; make it from this position of proof.*

**Done when:** you have a working two-platform loop, paying customers, a case study, and enough signal to choose your end-game on purpose.

---

## What I'd deliberately NOT do right now

Saying no is half the plan. Resist these, even though they're tempting:

- ❌ **Don't build new features.** You have more product than proof. No new modules until the loop is closed and proven.
- ❌ **Don't open public self-serve signup yet.** Design partners first. Strangers hitting an unproven loop will churn and trash the brand.
- ❌ **Don't expand to SiteLink/Yardi yet.** Nail storEDGE (where the scaffolding exists) and your own facility first. PMS expansion is a Phase-5+ moat investment, not a now thing.
- ❌ **Don't chase the big REITs or 500+ operators.** Not your market, by design.
- ❌ **Don't finish the rename plumbing or polish the docs as a priority.** It's worth doing (see the contradictions doc) but it's housekeeping, not a blocker. Batch it for a slow week.
- ❌ **Don't perfect the security hardening items.** They're real but medium-priority and none are customer-blocking. Do them alongside Phase 3, not before the loop.

---

## The whole plan on one screen

| Phase | Weeks | Goal | The one thing that matters |
|-------|-------|------|---------------------------|
| **0** | Now | Protect the data | Confirm backups + test restore |
| **1** | 1–3 | Close the loop (Meta) | A real move-in fires a Meta conversion |
| **2** | 2–5 | Get design partners | 3–5 operators live, hand-billed |
| **3** | 4–8 | Make money safe | Pricing reconciled + checkout wired |
| **4** | 6–12 | Prove it & decide | One undeniable case study, then choose the end-game |

---

## The single most important sentence in this whole guide

**Connect the move-in loop on Meta and watch a real move-in at your own facility fire a conversion — because the day that works, you stop having "a big impressive codebase" and start having "the thing the whole company is about." Everything else is in service of that one moment.**
