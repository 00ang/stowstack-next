import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Operator Notes | StorageAds",
  description:
    "Short-form thoughts on self-storage marketing from an operator who spends his own money on ads every month. Attribution, cost per move-in, and what actually works.",
  openGraph: {
    title: "Operator Notes | StorageAds",
    description: "Short-form thoughts on self-storage marketing from an operator who spends his own money on ads every month.",
    url: "https://storageads.com/insights",
  },
  twitter: {
    card: "summary_large_image",
    title: "Operator Notes | StorageAds",
    description: "Short-form thoughts on self-storage marketing from an operator who spends his own money on ads.",
  },
};

const POSTS = [
  {
    title: "The Receipt That Started Everything",
    body: `Operators routinely pay a marketing agency $4,200 a month and cannot get a straight answer about move-ins.

Ask how many the ads actually drove and you get "well, your impressions are up."

Impressions don't pay the mortgage on a $3M building.

That gap is the reason this system exists. Not because storage needs more marketing tech. Because operators deserve to know where the money went.

A lot of operators feel the same way.`,
  },
  {
    title: "Clicks Are Not Move-Ins",
    body: `Your Google Ads campaign got 500 clicks last month. Your agency is celebrating.

But how many of those clicks actually called? How many of those calls converted? How many moved in and stayed past 30 days?

If you can't answer those questions, you're not doing marketing. You're doing hope.

Attribution isn't a buzzword. It's knowing which dollar made you money and which one didn't.`,
  },
  {
    title: "The Two-Week Experiment",
    body: `Here's a test most agencies will talk you out of.

Turn off all the ads for two weeks.

If your move-in rate barely changes, you just learned something expensive.

It means most of those "results" were people who would have found you anyway. You were paying to show ads to renters already searching your facility by name.

Real marketing finds NEW customers. Not people already walking through the door.`,
  },
  {
    title: "Why Your Agency Loves Branded Search",
    body: `Here's something your marketing agency will never tell you:

A huge chunk of your Google Ads budget is probably going to branded search. That means you're paying for clicks from people who already know your name and were going to find you anyway.

It looks great in reports. High click-through rate. Low cost per click. "Great performance."

But it's like paying someone to hold the door open at a party you're already hosting.

Ask your agency what percentage of your spend is branded vs. non-branded. Watch the silence.`,
  },
  {
    title: "The Occupancy Trap",
    body: `At 92% occupancy, most operators stop marketing.

I get it. Feels wasteful to spend money when you're nearly full.

But the best time to push marketing is when you're strong. That's when you raise rates. That's when you build a waitlist. That's when you have leverage.

Cutting marketing at 92% means you're scrambling at 84%.

The operators who grow market from strength, long before panic sets in.`,
  },
  {
    title: 'The Problem With "Cost Per Lead"',
    body: `Your agency says your cost per lead is $35. Sounds good, right?

But what's a "lead"?

Someone who clicked an ad? Someone who visited your website? Someone who called and asked your hours and never came back?

Track it properly for two quarters and the real number shows up. It's cost per move-in. For most operators that number is 3-5x what their agency reports as "cost per lead."

The gap between those two numbers is where your money disappears.`,
  },
  {
    title: "Nobody Teaches Operators Marketing",
    body: `I went to every storage conference for three years. Sat in every marketing session.

Know what I learned? Vendors selling their product from the stage.

Nobody teaches operators how marketing actually works. How attribution works. How to read an ad account. How to know if your money is being wasted.

So we figure it out the hard way. By spending money and hoping.

I think operators deserve better than that.`,
  },
  {
    title: "What I Tell New Facility Owners",
    body: `A buddy just closed on his first facility. Asked me what to do about marketing.

I told him three things:

Own your tracking from day one. Don't outsource your understanding of where tenants come from.

Never sign a contract where the agency controls your ad accounts. That's your data.

If someone can't tell you cost per move-in, they can't tell you anything useful.

He said every other operator told him to "just hire an agency." That's the problem.`,
  },
  {
    title: "The Vanity Metric Graveyard",
    body: `Metrics that sound impressive but mean nothing for storage operators:

Impressions. (Who cares how many people scrolled past your ad?)

Click-through rate. (A click isn't a customer.)

"Engagement." (Likes don't pay rent.)

Website traffic. (Visitors aren't tenants.)

The only metrics that matter: calls from new prospects, walk-ins attributed to a campaign, actual move-ins, and revenue per marketing dollar spent.

Everything else is decoration.`,
  },
  {
    title: "One Test For Every Feature",
    body: `Every feature in this system has to answer one question. Does it fill units?

Not does it look good in a demo. Not does it make a chart go up.

Plenty of storage software gets built to win a sales call. It adds a tab, a score, a badge. None of it puts a renter in a unit.

If a feature can't be traced to a move-in, it doesn't ship.

That's the whole bar.`,
  },
  {
    title: "The Agency Model Is Broken",
    body: `Most storage marketing agencies charge a percentage of ad spend.

Think about what that incentivizes. They make MORE money when you spend MORE money. Whether it works or not.

Would you pay your facility manager a bonus every time they increased expenses?

Alignment matters. Your marketing partner should win when you win. Not when your credit card bill goes up.`,
  },
  {
    title: "What Happens When You Track Phone Calls",
    body: `Start recording and tracking every inbound call at your facility. Give it a month.

Here's the usual result:

About 40% of the "leads" from your ads are existing tenants calling about their account. Another 15% are vendors and spam.

Your agency is counting all of those as conversions.

You're paying for leads who are already your customers. Clean that up and your real cost per new tenant often doubles from what was being reported.

The truth hurts. But it saves you money.`,
  },
  {
    title: "The 3am Spreadsheet",
    body: `Every operator has had this night. You're up at 3am trying to work out which of three ad campaigns produced the 11 move-ins you got that month.

Google says one thing. The agency says another. Your site manager's gut says something else entirely.

Nobody is lying. The connection between the ad spend and the signed lease was never built.

That's the problem this system was built to end. Not for the reporting. So you stop guessing with your own money.`,
  },
  {
    title: "Why Storage Marketing Is Different",
    body: `Storage isn't e-commerce. You can't track a click to a purchase in 30 seconds.

Someone sees an ad Monday. Visits your site Wednesday. Drives by Saturday. Calls the following Tuesday. Moves in two weeks later.

That journey is messy. Most marketing tools are built for clean, instant conversions.

Storage needs marketing tools built for storage. For the long, weird, multi-touch journey that actually happens.

Stop forcing your business into tools that weren't built for it.`,
  },
  {
    title: "The Rate Increase Hack Nobody Talks About",
    body: `This one changes how operators price:

When your marketing is dialed in and lead flow is steady, rate increases get easy.

You're not desperate. You're not worried about vacancies. You raise rates because you can backfill any unit that walks.

Bad marketing doesn't just cost you the ad spend. It costs you the confidence to price correctly.

Good marketing is a rate strategy as much as a lead strategy.`,
  },
  {
    title: "Your Ad Account Should Be Yours",
    body: `If your agency won't give you admin access to your own ad accounts, that's a red flag the size of a 10x30.

Your data. Your campaigns. Your spend history. It should all be yours.

I've talked to operators who switched agencies and lost years of campaign data because the old agency owned the accounts.

That's like a property manager keeping your tenant list when you fire them.

Don't let anyone hold your marketing data hostage.`,
  },
  {
    title: "The Move-In Source Question",
    body: `I ask every operator the same question: "Where did your last 10 move-ins come from?"

Most can't answer it. Some guess. A few say "the internet" like that narrows it down.

If you don't know where your tenants are coming from, you don't know which marketing is working. And if you don't know what's working, you're just spreading money around and hoping.

That one question, where did they come from, is the foundation of everything.`,
  },
  {
    title: "Why I Don't Trust Marketing Dashboards",
    body: `Most marketing dashboards are designed to make the agency look good.

Green arrows everywhere. Charts going up and to the right. Lots of big numbers.

But when you ask "how many of those became tenants," the dashboard goes quiet.

A good dashboard answers one question: is my marketing making me money?

If yours doesn't answer that, it's not a dashboard. It's a distraction.`,
  },
  {
    title: "Talking to 50 Operators Changed Everything",
    body: `Over the past year I've talked to 50+ storage operators about their marketing.

The pattern is always the same:

They're spending money. They think it's probably working. They can't prove it. They feel stuck because they don't know enough about marketing to challenge their agency. And they're a little embarrassed to admit it.

You're not alone. This is an industry-wide problem. And it's not your fault. The tools and transparency just haven't existed.

That's changing.`,
  },
  {
    title: "What Operators Actually Want",
    body: `After hundreds of conversations with storage operators, I can tell you what they want from marketing. It's not complicated.

Tell me how many move-ins my ads drove this month. Tell me what each one cost. Tell me which campaigns to keep and which to kill.

That's it. That's the whole wish list.

The fact that most operators can't get a straight answer to those three things tells you everything about the state of storage marketing today.

We can do better. We should do better.`,
  },
];

export default function InsightsPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-light)", color: "var(--color-dark)" }}
    >
      {/* Nav */}
      <header
        className="sticky top-0 z-[100] border-b"
        style={{
          background: "var(--color-light)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <ArrowLeft size={20} />
          </Link>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              letterSpacing: "-0.5px",
            }}
          >
            <span style={{ color: "var(--color-dark)" }}>storage</span>
            <span style={{ color: "var(--color-gold)" }}>ads</span>
          </span>
          <span
            className="text-sm ml-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            / Operator Notes
          </span>
        </div>
      </header>

      {/* Header */}
      <div className="max-w-2xl mx-auto px-6 pt-24 pb-8">
        <h1
          className="font-semibold mb-3"
          style={{
            fontSize: "var(--text-section-head)",
            lineHeight: "var(--leading-tight)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          Operator Notes
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "var(--text-body)",
            maxWidth: "520px",
          }}
        >
          Short-form thoughts on self-storage marketing from someone who spends
          his own money on ads every month.
        </p>
      </div>

      {/* Posts */}
      <div className="max-w-2xl mx-auto px-6 pb-32">
        {POSTS.map((post, i) => (
          <div key={i}>
            {/* Divider */}
            <div
              style={{
                height: "1px",
                background: "var(--border-subtle)",
                margin: i === 0 ? "2rem 0" : "0",
              }}
            />

            <div className="py-10">
              <h2
                className="font-semibold mb-4"
                style={{
                  fontSize: "var(--text-subhead)",
                  lineHeight: "var(--leading-snug)",
                }}
              >
                {post.title}
              </h2>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body)",
                  lineHeight: "var(--leading-normal)",
                  color: "var(--text-secondary)",
                  whiteSpace: "pre-line",
                }}
              >
                {post.body}
              </div>
            </div>

            {/* Divider after each post */}
            {i < POSTS.length - 1 && (
              <div
                style={{
                  height: "1px",
                  background: "var(--border-subtle)",
                }}
              />
            )}
          </div>
        ))}

        {/* Sign-off */}
        <div
          className="mt-8 pt-8"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <p
            className="text-sm italic"
            style={{ color: "var(--text-tertiary)" }}
          >
            These notes come from running ads for storage and from hundreds of
            conversations with operators. No theory. No vendor pitch.
          </p>
        </div>

        {/* CTA */}
        <div
          className="mt-12 rounded-lg p-8 text-center"
          style={{
            background: "rgba(181,139,63,0.06)",
            border: "1px solid var(--color-gold)",
          }}
        >
          <p
            className="font-semibold mb-2"
            style={{
              fontSize: "var(--text-subhead)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Want to know your real cost per move-in?
          </p>
          <p
            className="mb-6 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Get a free diagnostic for your facility.
          </p>
          <Link href="/diagnostic" className="btn-primary inline-block">
            Get a Free Facility Audit
          </Link>
        </div>
      </div>
    </div>
  );
}
