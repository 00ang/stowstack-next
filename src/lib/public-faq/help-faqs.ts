export type HelpFaq = { question: string; answer: string };

/** Public help-center copy at /help. */
export const HELP_FAQ_CATEGORIES: { title: string; items: HelpFaq[] }[] = [
  {
    title: "Getting Started",
    items: [
      { question: "How does StorageAds work?", answer: "StorageAds creates ad-specific landing pages with embedded reservation flows. We track every click from your ads through to a signed lease, giving you real cost-per-move-in data instead of just clicks." },
      { question: "How long does setup take?", answer: "Most facilities are live within 48 hours. We handle the initial setup, including ad account connections, landing page creation, and campaign configuration." },
      { question: "Do I need a storEDGE account?", answer: "Yes. StorageAds integrates with storEDGE for online reservations and move-in tracking. This connection is how we tie each move-in back to the ad that produced it." },
    ],
  },
  {
    title: "Billing",
    items: [
      { question: "How much does StorageAds cost?", answer: "Pricing is per facility per month. Plans range from $750 to $2,000+ depending on services. Visit storageads.com/pricing for current rates." },
      { question: "Is there a contract?", answer: "Month-to-month. No long-term contracts. You can cancel anytime from your Settings page." },
      { question: "How does billing work for multiple facilities?", answer: "Each facility is billed separately. Multi-facility operators get a single invoice with per-facility line items." },
    ],
  },
  {
    title: "Campaigns & Reporting",
    items: [
      { question: "What is cost per move-in?", answer: "Cost per move-in is your total ad spend divided by the number of attributed move-ins. Unlike cost per lead or cost per click, this measures actual revenue: a signed lease." },
      { question: "How accurate is the attribution?", answer: "We track the full journey: ad click → landing page → storEDGE reservation → move-in. Attribution is based on this complete chain, not estimates." },
      { question: "Can I download reports?", answer: "Yes. Go to Reports in your dashboard to generate PDF or CSV reports for any date range. Reports include move-in attribution, campaign performance, and ROI breakdowns." },
    ],
  },
];
