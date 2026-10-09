/**
 * FAQ content for the operator tools at /tools — single source of truth.
 *
 * Each tool renders these twice from the same data: as the visible <Faq> blocks
 * in the client component, and as FAQPage structured data (FaqJsonLd) in the
 * server page so crawlers can surface them as rich results. Keeping the copy
 * here means the visible text and the schema can never drift apart.
 *
 * Plain strings only — no JSX — so they serialize cleanly into JSON-LD.
 */

export interface ToolFaq {
  q: string;
  a: string;
}

export const NOI_FAQS: ToolFaq[] = [
  {
    q: "What exactly is NOI?",
    a: "Net operating income is your effective gross income minus your operating expenses. It is the cash the property throws off before financing and taxes. Formula: EGI − operating expenses = NOI.",
  },
  {
    q: "What is effective gross income (EGI)?",
    a: "Gross potential rent (every unit full at street rate) minus vacancy and credit loss, plus other income like tenant insurance commissions, late fees, admin fees, retail, and truck rental. It is the income you actually collect.",
  },
  {
    q: "Which expenses belong in NOI?",
    a: "Only operating costs of running the facility: payroll, property taxes, insurance, utilities, repairs, marketing, management fees, office/software, processing fees, security, grounds, and professional fees. Keep them storage-specific.",
  },
  {
    q: "What should I leave out?",
    a: "Your mortgage and interest, capital expenditures (new roof, paving, door replacement), depreciation, amortization, and income taxes. Those sit below NOI. Folding them in understates your NOI and distorts your valuation.",
  },
  {
    q: "How does NOI drive my facility's value?",
    a: "Buyers value storage on a cap rate: value = NOI ÷ cap rate. At a 6.5% cap, every extra $10,000 of annual NOI adds roughly $154,000 of value. Filling units and raising rates is the fastest lever, which is exactly what marketing should be measured against.",
  },
  {
    q: "What's a healthy expense ratio?",
    a: "Self-storage operating expense ratios commonly land in the 35–45% range of EGI, varying with management model, climate control, taxes, and market. Your number is a starting point for a conversation, not a verdict.",
  },
];

export const RATE_INCREASE_FAQS: ToolFaq[] = [
  {
    q: "What's a break-even move-out rate?",
    a: "It's the share of tenants who could leave before the increase nets you zero. For an X% increase it works out to X ÷ (100 + X). An 8% increase break-evens at about 7.4% move-outs, so as long as fewer than ~7 in 100 leave, you're ahead.",
  },
  {
    q: "Why does the model assume vacated units sit empty?",
    a: "To keep the number conservative. In practice you backfill many vacated units at street rate, often higher than the rate the leaving tenant paid, so real lift usually beats this floor. We'd rather under-promise.",
  },
  {
    q: "Why do rate increases beat chasing new move-ins?",
    a: "An increase has no acquisition cost and flows almost entirely to NOI. The risk is purely move-outs, which is why the safe way to push ECRIs harder is to keep your marketing funnel full enough to replace anyone who leaves.",
  },
  {
    q: "How often can I raise rates?",
    a: "Many operators run ECRIs on a rolling 6–12 month cadence per tenant, subject to your state's notice rules and any local caps. This tool models a single increase event; check local regulations before scheduling.",
  },
];

export const BREAK_EVEN_FAQS: ToolFaq[] = [
  {
    q: "Operating vs all-in break-even: what's the difference?",
    a: "Operating break-even is the occupancy that covers the cost of running the facility. All-in adds your debt service, so it's the occupancy you need to avoid feeding the property out of pocket. All-in is the number that keeps you up at night.",
  },
  {
    q: "Why use average rate instead of unit-by-unit?",
    a: "For a break-even read, blended average rate is close enough and far simpler. If your mix is unusual, run it with a conservative average and treat the result as a floor.",
  },
  {
    q: "What's a comfortable cushion?",
    a: "The bigger the gap between current occupancy and all-in break-even, the more resilient you are to a soft quarter or a rate war. A thin cushion means a few move-outs can flip you cash-flow negative. That is exactly when filling units fast matters most.",
  },
  {
    q: "Does this include capital expenditures?",
    a: "No. Break-even here is operating costs plus debt. Big one-time capital projects (paving, roofs, door replacement) sit outside this and should be reserved for separately.",
  },
];

export const VALUATION_FAQS: ToolFaq[] = [
  {
    q: "What is a cap rate?",
    a: "The capitalization rate is the annual NOI as a percentage of the price. A facility with $300,000 NOI selling at a 6% cap is worth $5,000,000 ($300,000 ÷ 0.06). Lower cap rate = higher price for the same NOI.",
  },
  {
    q: "Why does a lower cap rate mean a higher value?",
    a: "Cap rate is the buyer's required yield. When buyers accept a lower yield, because the market is hot or the asset is strong, they pay more for each dollar of NOI, so value rises.",
  },
  {
    q: "What cap rate should I use?",
    a: "Use what comparable facilities in your market are actually trading at. Storage broadly runs in the mid-5% to mid-7% range, but it moves with interest rates, asset quality, and location. A broker's recent comps beat a rule of thumb.",
  },
  {
    q: "How do I grow the value?",
    a: "Grow NOI. At a fixed cap rate, value moves one-for-one with NOI, and NOI grows when you fill units and hold rate. That is the entire case for treating marketing as a value-creation lever, not a cost.",
  },
];

export const LEASE_UP_FAQS: ToolFaq[] = [
  {
    q: "How is months-to-stabilization calculated?",
    a: "Month by month. Each month adds your gross move-ins and subtracts your move-out rate applied to the units already occupied, until occupancy reaches your target. Because churn compounds against a growing base, there's no clean formula, so we simulate it.",
  },
  {
    q: "Why does it say my facility never stabilizes?",
    a: "Move-outs scale with how full you are. At steady state, move-ins equal move-outs, so your ceiling is move-ins ÷ monthly move-out rate. If that ceiling sits below your target occupancy, no amount of time gets you there at the current pace. You need more move-ins or lower churn.",
  },
  {
    q: "What move-in pace should I expect?",
    a: "It depends on market demand, your visibility, and price. That's the whole point of measuring it: a higher, steadier move-in pace pulls your stabilization date forward by months. Marketing that lifts move-ins is the lever this tool makes visible.",
  },
  {
    q: "What's a realistic monthly move-out rate?",
    a: "Storage monthly churn commonly runs a few percent of occupied units. Use your own PMS number if you have it; if not, model a conservative (higher) rate and treat the resulting timeline as the slow case.",
  },
];

export const EXPANSION_FAQS: ToolFaq[] = [
  {
    q: "What is yield on cost?",
    a: "Stabilized added NOI divided by the total cost to build. It's the development version of a cap rate: what the new units earn per dollar you spend. If yield on cost beats the cap rate you'd pay to buy the same NOI, building creates value.",
  },
  {
    q: "What's the development spread, and why does it matter?",
    a: "It's yield on cost minus the market cap rate, in points. A positive spread means each dollar of capex converts into more than a dollar of value at exit, and that gap is your development profit. A spread near zero means you're building for the same price you could buy.",
  },
  {
    q: "What should I use for the operating expense ratio?",
    a: "Self-storage operating expense ratios commonly land in the 35–45% range of gross rent. New units bolted onto an existing facility often run leaner because they share staff and overhead, so a lower ratio can be defensible.",
  },
  {
    q: "Does this account for lease-up time?",
    a: "No. It models the stabilized year once the new units are full. New units take months to fill, so discount the early years accordingly. Use the lease-up calculator to estimate how long that takes.",
  },
];

export const CONCESSION_FAQS: ToolFaq[] = [
  {
    q: "How much does a free month actually cost me?",
    a: "Up front, one month's rent per move-in. But over a tenant's stay it's a much smaller slice: a free month against a 12-month average stay is roughly 8% of that tenant's lifetime revenue, and far less for longer stays.",
  },
  {
    q: "Why spread the concession over length of stay?",
    a: "Because a storage tenant pays rent every month they stay. Judging a one-time concession against a single month overstates it; judging it against lifetime revenue is the honest measure of what you actually gave up.",
  },
  {
    q: "When is a concession worth it?",
    a: "When it wins a move-in you wouldn't have gotten and that tenant stays long enough that the concession is a thin slice of their lifetime revenue. A concession on a tenant who'd have rented anyway is pure margin given away.",
  },
  {
    q: "Concession or a lower street rate?",
    a: "A concession is a one-time cost that resets to full rate; a lower street rate compounds every month for the life of the tenancy. For long-staying tenants the permanent rate cut is usually the more expensive choice. This tool lets you compare the effective rate either way.",
  },
];

export const DSCR_FAQS: ToolFaq[] = [
  {
    q: "What is DSCR?",
    a: "The debt service coverage ratio is your annual NOI divided by your annual debt service (principal + interest). A 1.25x DSCR means the property throws off $1.25 of NOI for every $1.00 of loan payment. It's the first number a storage lender looks at.",
  },
  {
    q: "What DSCR do lenders require?",
    a: "Most self-storage lenders size loans to a 1.20–1.35x DSCR, with 1.25x a common floor. Tighter credit, weaker markets, or lease-up deals push the required ratio higher; stabilized, well-located assets can clear at the low end.",
  },
  {
    q: "How does DSCR size my loan?",
    a: "In 'size a loan' mode the tool works backward: it caps annual debt service at NOI ÷ your target DSCR, then solves for the largest fully-amortizing loan whose payment fits that cap at your rate and term. Raise NOI or lower the rate and the supportable loan grows.",
  },
  {
    q: "What's debt yield, and why do lenders care?",
    a: "Debt yield is NOI ÷ loan amount. Unlike DSCR and LTV it ignores rate and term, so lenders use it as a rate-proof sanity check on leverage. Storage debt yields commonly need to clear roughly 9–10%.",
  },
  {
    q: "Does this replace a lender quote?",
    a: "No. It's a fast underwriting sketch using a single fixed rate and a full amortization. Real terms involve appraised value, recourse, reserves, interest-only periods, and balloon dates. Use it to ballpark, then confirm with your lender or broker.",
  },
];

export const MARKETING_ROI_FAQS: ToolFaq[] = [
  {
    q: "How is cost per move-in calculated?",
    a: "It's your total ad spend divided by the number of move-ins that spend produced. The field starts at a sample number. Replace it with yours.",
  },
  {
    q: "What is return on ad spend (ROAS)?",
    a: "ROAS is the revenue produced for every dollar of ad spend. Because storage revenue recurs every month, even a modest cost per move-in compounds: a tenant acquired once pays rent for the length of their stay, so the lifetime return dwarfs the first month shown here.",
  },
  {
    q: "Why does the monthly revenue look conservative?",
    a: "The headline additional revenue counts only the rent from one month's move-ins, at your current average rate. It ignores the months those tenants stay, any rate increases they'll absorb, and tenant insurance and fee income. Real return runs higher.",
  },
  {
    q: "Can marketing actually fill my vacant units?",
    a: "Only if there's demand in your market and your listings convert. This tool shows the move-in math; the free facility audit shows whether you're visible enough to capture it. Run both, then we can talk about which campaigns to run.",
  },
];
