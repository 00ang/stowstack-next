export type HomepageFaq = {
  q: string;
  a: string;
  cite?: number[];
};

/** Public homepage FAQ copy. Also the source for the on-page accordion. */
export const HOMEPAGE_FAQS: HomepageFaq[] = [
  {
    q: "We're not running any ads right now.",
    a: "Most independent operators aren't. The system is built for that starting point. Market mapping, ads, landing pages, and follow-up all deploy from zero in the first week.",
  },
  {
    q: "What does the system include?",
    a: "Market intelligence. Ad creation and publishing to Meta and Google. Dedicated landing pages with storEDGE rental embedded. Retargeting. A/B testing scored by move-in outcome. Reservation-to-move-in conversion. Revenue intelligence. Organic capture. One dashboard.",
  },
  {
    q: "Do we need marketing experience to run it?",
    a: "No. The system builds campaigns from your facility data and puts them live, then handles targeting, bidding, and creative rotation. You approve and watch the numbers.",
  },
  {
    q: "How fast is it live?",
    a: "Ads are live in the first week. Move-ins start in weeks two through three as the campaigns gather data and retargeting kicks in. By month three you have a real baseline.",
  },
  {
    q: "How does the AI Creative Studio work?",
    a: "It generates ad copy, headlines, and landing page variants from your facility data: unit types, pricing, location, competitive positioning. You review and publish. New creative on demand without a retainer.",
  },
  {
    q: "We already get plenty of walk-ins and Google traffic.",
    a: "Good. That puts you ahead of most independents. The catch is Google's local algorithm weights proximity and review recency over brand size, which is the one place independents can outrank REIT locations. If you're not actively managing Google Business Profile, reviews, and retargeting the visitors you already get, you're sitting on the lever that costs the REITs $250M a year to operate at scale. The audit shows you which side of that gap you're on.",
    cite: [6],
  },
  {
    q: "We're in Texas (or Florida, or a Sun Belt metro). The market is rough.",
    a: "It is. San Antonio added roughly 656,000 square feet of new supply in 2026. Houston added 430,000. National supply growth is still slowing to 1.5% a year through 2027, but the oversupplied metros are absorbing first. You can't make new supply disappear. You can control how your facility prices against competitors, how fast you respond to leads, how your reviews read, and how the page performs at 11pm on a Sunday. That's the lever, and it's what the system runs.",
    cite: [10],
  },
  {
    q: "California passed SB 709. Should we worry about ECRI legislation?",
    a: "If you're in California, yes: SB 709 caps annual existing-customer rate increases at the lower of 5% + CPI or 10% as of January 2026. Twenty-four states introduced storage pricing bills in 2025. The NYC Department of Consumer and Worker Protection has an active case against Extra Space over the bait-and-switch ECRI playbook. The era of low introductory rate plus aggressive ECRI is closing. Operators who can't run real demand generation get squeezed first. The system is built so new-customer acquisition is your durable lever, not pricing tactics regulators are killing.",
    cite: [7, 8],
  },
  {
    q: "We only have one facility. Is this for us?",
    a: "Yes. One facility is the primary use case. The Portfolio plan covers operators with five or more.",
  },
  {
    q: "How does the storEDGE integration work?",
    a: "Landing pages embed the storEDGE reservation widget. The renter books on your branded page, and the reservation lands in storEDGE the same as a walk-in. Rates, availability, and payments stay in your existing system.",
  },
  {
    q: "What if it doesn't work?",
    a: "If move-ins haven't improved by the end of month three, month four is free. You carry no risk for a quarter that didn't fill units.",
  },
];
