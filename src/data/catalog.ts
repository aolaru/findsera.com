import clusters from "./generated/clusters.generated.json";
import products from "./generated/products.generated.json";
import roundups from "./generated/roundups.generated.json";
import topics from "./generated/topics.generated.json";

export type ProductCategory = "gadgets" | "kitchen" | "home";
export type AffiliateMode = "exact" | "search";

export type Product = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  category: ProductCategory;
  price: number;
  priceLabel: string;
  image: string;
  description: string;
  sourceUrl: string;
  priceCheckedAt: string;
  affiliateUrl: string;
  affiliateMode: AffiliateMode;
  amazonUrl?: string;
  amazonQuery: string;
  tags: string[];
  highlights: string[];
  isTrending: boolean;
};

export type RoundupSection = {
  title: string;
  body: string;
};

export type RoundupFaq = {
  question: string;
  answer: string;
};

export type Roundup = {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  eyebrow: string;
  category: ProductCategory | null;
  cluster: string;
  updatedAt: string;
  intro: string;
  productIds: string[];
  productCount: number;
  sections: RoundupSection[];
  faqs: RoundupFaq[];
};

export type Topic = {
  slug: string;
  title: string;
  description: string;
  productIds: string[];
  roundupSlugs: string[];
  categoryCounts: Partial<Record<ProductCategory, number>>;
  productCount: number;
  roundupCount: number;
};

export type Cluster = {
  slug: string;
  title: string;
  description: string;
  roundupSlugs: string[];
  categories: ProductCategory[];
  roundupCount: number;
};

export type SearchItem = {
  title: string;
  href: string;
  type: "Product" | "Guide" | "Category" | "Page";
  meta?: string;
  keywords?: string[];
};

export const allProducts = [...products] as Product[];
export const allRoundups = [...roundups] as Roundup[];
export const allTopics = [...topics] as Topic[];
export const allClusters = [...clusters] as Cluster[];

export const categoryLabels: Record<ProductCategory, string> = {
  gadgets: "Gadgets",
  kitchen: "Kitchen",
  home: "Home"
};

export const categoryDescriptions: Record<ProductCategory, string> = {
  gadgets: "Travel tech, desk gear, and compact electronics with strong day-to-day usefulness.",
  kitchen: "Coffee gear and precision kitchen tools chosen for repeatable results and easier routines.",
  home: "Home-comfort products that improve focus, air quality, and slower daily rituals."
};

export const categories = Object.keys(categoryLabels).map((slug) => ({
  slug: slug as ProductCategory,
  label: categoryLabels[slug as ProductCategory],
  description: categoryDescriptions[slug as ProductCategory]
}));

const staticSearchPages: SearchItem[] = [
  {
    title: "About Findsera",
    href: "/about",
    type: "Page",
    meta: "About",
    keywords: ["about", "findsera", "mission", "editorial"]
  },
  {
    title: "How We Pick Products",
    href: "/how-we-pick-products",
    type: "Page",
    meta: "Methodology",
    keywords: ["how we pick products", "methodology", "reviews", "editorial process"]
  },
  {
    title: "Affiliate Disclosure",
    href: "/affiliate-disclosure",
    type: "Page",
    meta: "Disclosure",
    keywords: ["affiliate disclosure", "commission", "links", "amazon associates"]
  },
  {
    title: "Contact Findsera",
    href: "/contact",
    type: "Page",
    meta: "Contact",
    keywords: ["contact", "support", "editorial questions", "brand requests"]
  }
];

export const getTrendingProducts = () => allProducts.filter((product) => product.isTrending);
export const getProductsUnderPrice = (price: number) =>
  allProducts.filter((product) => product.price <= price);
export const getProductsByCategory = (category: ProductCategory) =>
  allProducts.filter((product) => product.category === category);
export const getProductsByTag = (tagSlug: string) =>
  allProducts.filter((product) => product.tags.some((tag) => slugify(tag) === tagSlug));
export const getProductById = (id: string) => allProducts.find((product) => product.id === id);
export const getProductBySlug = (slug: string) => allProducts.find((product) => product.slug === slug);
export const getRoundupBySlug = (slug: string) => allRoundups.find((roundup) => roundup.slug === slug);
export const getTopicBySlug = (slug: string) => allTopics.find((topic) => topic.slug === slug);
export const getClusterBySlug = (slug: string) =>
  allClusters.find((cluster) => cluster.slug === slug);

export const getProductsForRoundup = (roundup: Roundup) =>
  roundup.productIds
    .map((id) => getProductById(id))
    .filter((product): product is Product => Boolean(product));

export const getRoundupsByCategory = (category: ProductCategory) =>
  allRoundups.filter((roundup) => roundup.category === category);

export const getRoundupsByCluster = (cluster: string) =>
  allRoundups.filter((roundup) => roundup.cluster === cluster);

export const getRoundupsForProduct = (product: Product) =>
  allRoundups.filter((roundup) => roundup.productIds.includes(product.id));

export const getRoundupsForTopic = (topic: Topic) =>
  topic.roundupSlugs
    .map((slug) => getRoundupBySlug(slug))
    .filter((roundup): roundup is Roundup => Boolean(roundup));

export const getProductsForTopic = (topic: Topic) =>
  topic.productIds
    .map((id) => getProductById(id))
    .filter((product): product is Product => Boolean(product));

export const getRoundupsForCluster = (cluster: Cluster) =>
  cluster.roundupSlugs
    .map((slug) => getRoundupBySlug(slug))
    .filter((roundup): roundup is Roundup => Boolean(roundup));

export const getTopicsForProduct = (product: Product) =>
  allTopics.filter((topic) => topic.productIds.includes(product.id));

export const getRelatedProducts = (product: Product, limit = 3) =>
  allProducts
    .filter(
      (entry) =>
        entry.id !== product.id &&
        (entry.category === product.category ||
          entry.tags.some((tag) => product.tags.includes(tag)))
    )
    .sort((a, b) => Number(b.isTrending) - Number(a.isTrending) || a.price - b.price)
    .slice(0, limit);

export const sortProductsByPrice = (collection: Product[]) =>
  [...collection].sort((a, b) => a.price - b.price);

export const getSearchItems = (): SearchItem[] => [
  ...allProducts.map((product) => ({
    title: product.title,
    href: `/products/${product.slug}`,
    type: "Product" as const,
    meta: product.priceLabel,
    keywords: [product.brand, product.category, ...product.tags]
  })),
  ...allRoundups.map((roundup) => ({
    title: roundup.title,
    href: `/${roundup.slug}`,
    type: "Guide" as const,
    meta: roundup.category ?? "All categories",
    keywords: [roundup.cluster, roundup.eyebrow, roundup.description]
  })),
  ...categories.map((category) => ({
    title: category.label,
    href: `/category/${category.slug}`,
    type: "Category" as const,
    meta: "Browse category",
    keywords: [category.slug, category.description]
  })),
  ...staticSearchPages
];

export const getAllProductTags = () =>
  Array.from(new Set(allProducts.flatMap((product) => product.tags))).sort((a, b) =>
    a.localeCompare(b)
  );

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
