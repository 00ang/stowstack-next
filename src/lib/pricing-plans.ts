export const demandEnginePlans = [
  {
    name: "Launch",
    price: "$750",
    period: "/mo per facility",
    description:
      "For operators ready to start filling units with paid ads.",
    features: [
      "Meta ad campaigns (Facebook + Instagram)",
      "2 ad-specific landing pages with embedded storEDGE rental flow",
      "Static creative and ad copy",
      "Monthly performance report with cost-per-move-in data",
    ],
    bestFor:
      "Single-facility operators testing paid ads for the first time.",
    isRecommended: false,
  },
  {
    name: "Growth",
    price: "$1,500",
    period: "/mo per facility",
    description:
      "The full system. This is where compounding kicks in.",
    features: [
      "Meta ad campaigns (Facebook + Instagram)",
      "Google PPC campaigns (search + display)",
      "5 ad-specific landing pages with embedded storEDGE rental flow",
      "Retargeting campaigns for abandoned visitors",
      "A/B testing on creative and landing pages",
      "Video creative production",
      "Full attribution dashboard: what each move-in cost and what it returned, by creative",
      "Campaign review call every two weeks",
    ],
    bestFor:
      "Operators who want every dollar tracked to a move-in and a dedicated team tightening campaigns every two weeks.",
    isRecommended: true,
  },
  {
    name: "Portfolio",
    price: "Custom",
    period: " pricing (5+ facilities)",
    description:
      "Everything in Growth, scaled across your portfolio.",
    features: [
      "Unlimited landing pages across all facilities",
      "Budget moved to whichever facilities fill cheapest",
      "Portfolio-level attribution and reporting",
      "Dedicated strategist",
      "Volume discount: 20-35% off per-facility rates",
    ],
    bestFor:
      "Multi-facility operators who want centralized campaign management with facility-level reporting.",
    isRecommended: false,
  },
];

export const conversionPlans = [
  {
    name: "Single Site",
    price: "$3,000 build + $199/mo",
    features: [
      "Custom designed and branded to your facility",
      "Embedded storEDGE rental flow: customers reserve without leaving your site",
      "Fast on mobile, built for the reserve button",
      "Trust elements and social proof built in",
    ],
    bestFor:
      "Operators whose current website is a default template or a page they haven't touched in years.",
  },
  {
    name: "Site + Landing Pages",
    price: "$5,000 build + $299/mo",
    tag: "best value",
    features: [
      "Everything in Single Site, plus:",
      "5 ad-specific landing pages built for campaign traffic",
      "Per-page tracking setup",
      "A/B testing framework",
      "Pages tested and improved monthly, scored by reservations",
    ],
    bestFor:
      "Operators planning to run paid ads (now or soon) who want the landing page infrastructure ready from day one.",
  },
  {
    name: "Portfolio Build",
    price: "Custom pricing (3+ facilities)",
    features: [
      "Everything in Site + Landing Pages, scaled across multiple facilities",
      "Shared brand system with per-facility customization",
      "Centralized management dashboard",
      "Volume pricing: 25-40% off per-facility rates",
    ],
    bestFor: "",
  },
];
