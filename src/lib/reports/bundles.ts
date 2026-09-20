import { REPORTS } from "@/lib/astrology/reports-catalog";
import { defaultPriceCents } from "./pricing";

export interface GiftBundle {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  /** Report ids included in the set. */
  reportIds: string[];
  /** Fraction off the summed list price, 0–0.6. */
  discount: number;
  /** Short gift-oriented blurb for the card. */
  giftNote: string;
}

export const GIFT_BUNDLES: GiftBundle[] = [
  {
    id: "bundle-vault-complete",
    title: "The Oracle Vault — Complete Set",
    tagline: "All 27 Vault readings. The deepest library we have ever produced.",
    icon: "🗝️",
    discount: 0.55,
    giftNote: "The collector's gift. A lifetime of reading, delivered at once.",
    reportIds: REPORTS.filter((r) => r.category === "Oracle Vault").map((r) => r.id),
  },
  {
    id: "bundle-know-thyself",
    title: "Know Thyself",
    tagline: "The five Vault readings that hit hardest on first contact.",
    icon: "🔮",
    discount: 0.35,
    giftNote: "The classic introduction gift for someone new to their own chart.",
    reportIds: [
      "vault-fingerprint",
      "vault-contradiction-map",
      "vault-signature-mistake",
      "vault-the-room",
      "vault-chart-speaks",
    ],
  },
  {
    id: "bundle-inner-weather",
    title: "Inner Weather",
    tagline: "Mood, attention, the body and the small hours.",
    icon: "🌗",
    discount: 0.35,
    giftNote: "For the sensitive one who feels everything and explains none of it.",
    reportIds: [
      "vault-weather-inside",
      "vault-attention-ecology",
      "vault-body-weather",
      "vault-three-am",
    ],
  },
  {
    id: "bundle-lineage",
    title: "Lineage & Legacy",
    tagline: "What you inherited, what haunts you, and what outlasts you.",
    icon: "🧬",
    discount: 0.35,
    giftNote: "A gift for family — parents, siblings, the keeper of the stories.",
    reportIds: [
      "vault-inheritance-ledger",
      "vault-ghosts",
      "vault-every-age",
      "vault-return-point",
    ],
  },
  {
    id: "bundle-people-and-presence",
    title: "People & Presence",
    tagline: "How you land, who you attract, and the you inside their heads.",
    icon: "🎭",
    discount: 0.35,
    giftNote: "For the connector, the leader, the one everyone has an opinion about.",
    reportIds: [
      "vault-the-room",
      "vault-people-you-attract",
      "vault-unseen-audience",
      "vault-yes-and-no",
      "vault-private-language",
    ],
  },
  {
    id: "bundle-makers-set",
    title: "The Maker's Set",
    tagline: "Craft, value, thresholds and the cost of your talent.",
    icon: "🛠️",
    discount: 0.35,
    giftNote: "For the artist, founder or builder in your life.",
    reportIds: [
      "vault-craft-signature",
      "vault-cost-of-your-gifts",
      "vault-price-tag",
      "vault-thresholds",
    ],
  },
  {
    id: "bundle-year-of-ritual",
    title: "A Year of Ritual",
    tagline: "A personal calendar, a charged environment, and the lesson underneath.",
    icon: "🕯️",
    discount: 0.35,
    giftNote: "A birthday or new-year gift, built to be used for twelve months.",
    reportIds: [
      "vault-constellation-calendar",
      "vault-charged-objects",
      "vault-hidden-curriculum",
      "vault-sound-of-your-chart",
      "vault-chart-as-city",
    ],
  },
];

export interface BundlePricing {
  listCents: number;
  priceCents: number;
  savingsCents: number;
  count: number;
}

/** Deterministic bundle price: list total minus discount, rounded down to a x900 ending. */
export function bundlePricing(bundle: GiftBundle): BundlePricing {
  const defs = bundle.reportIds
    .map((id) => REPORTS.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r);
  const listCents = defs.reduce((sum, d) => sum + defaultPriceCents(d), 0);
  const raw = Math.round(listCents * (1 - bundle.discount));
  const priceCents = Math.max(900, Math.floor(raw / 1000) * 1000 + 900);
  return {
    listCents,
    priceCents,
    savingsCents: Math.max(0, listCents - priceCents),
    count: defs.length,
  };
}

export function getBundle(id: string): GiftBundle | undefined {
  return GIFT_BUNDLES.find((b) => b.id === id);
}
