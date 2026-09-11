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
    body: `I once paid a marketing agency $4,200/month for my storage facility.

When I asked how many move-ins the ads actually drove, the answer was "well, your impressions are up."

Impressions don't pay the mortgage on a $3M building.

That was the month I started building my own tracking system. Not because I wanted to be in marketing tech. Because I wanted to know where my money was going.

Turns out a lot of operators feel the same way.`,
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
    body: `When I took over marketing on my own facility, I did something my agency thought was crazy.

I turned off all the ads for two weeks.

Move-in rate barely changed.

That told me most of my "results" were people who were going to find me anyway. I was paying to show ads to people already searching my facility name.

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

But here's what I learned running my own facility: the best time to push marketing is when you're strong. That's when you raise rates. That's when you build a waitlist. That's when you have leverage.

Cutting marketing at 92% means you're scrambling at 84%.

The operators who grow market from strength, long before panic sets in.`,
  },
  {
    title: 'The Problem With "Cost Per Lead"',
    body: `Your agency says your cost per lead is $35. Sounds good, right?

But what's a "lead"?

Someone who clicked an ad? Someone who visited your website? Someone who called and asked your hours and never came back?

I spent two years tracking this at my own facility. The real number that matters is cost per move-in. And for most operators, that number is 3-5x what their agency is reporting as "cost per lead."

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
    title: "I Still Run Ads on My Own Facility",
    body: `People ask why I still personally manage the marketing on my own facility.

Because I need to feel the pain.

If I'm going to build tools for operators, I need to spend my own money on ads every month. I need to feel that sting when a campaign flops. I need to celebrate when one works.

The day I stop operating is the day I stop understanding what operators need.

I eat my own cooking. Every single month.`,
  },
  {
    title: "The Agency Model Is Broken",
    body: `Most storage marketing agencies charge a percentage of ad spend.

Think about what that incentivizes. They make MORE money when you spend MORE money. Whether it works or not.

Would you pay your facility manager a bonus every time they increased expenses?

Alignment matters. Your marketing partner should win when you win. Not when your credit card bill goes up.`,
  },
  {
    title: "What Happened When I Tracked Phone Calls",
    body: `I started recording and tracking every inbound call at my own facility.

Within the first month I discovered:

40% of "leads" from our ads were existing tenants calling about their account. Another 15% were vendors and spam.

My agency was counting all of those as conversions.

I was paying for leads that were already my customers. Once I cleaned that up, my actual cost per new customer nearly doubled from what was being reported.

The truth hurts. But it saves you money.`,
  },
  {
    title: "The 3am Realization",
    body: `I was up at 3am staring at a spreadsheet trying to figure out which of my three ad campaigns actually drove the 11 move-ins we got that month.

Google said one thing. The agency said another. My site manager's gut said something else entirely.

That was the night I decided: if I have to build a system that actually connects ad spend to move-ins, I will.

Not because I wanted a side project. Because I was tired of guessing with my own money.`,
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
    body: `Here's something I learned running my own facility that changed everything:

When your marketing is dialed in and you have consistent lead flow, rate increases become easy.

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
            All of these are from my own experience running ads on my own
            facilities and talking to hundreds of operators. No theory. No
            vendor pitch.
          </p>
          <p className="mt-4">
            <span
              className="font-semibold"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-primary)",
              }}
            >
              Blake
            </span>
            <span
              className="text-sm ml-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              Founder, StorageAds.com
            </span>
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
