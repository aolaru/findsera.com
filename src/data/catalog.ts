import products from "./generated/products.generated.json";
import roundups from "./generated/roundups.generated.json";

export type ProductCategory = "gadgets" | "kitchen" | "home";

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
  updatedAt: string;
  intro: string;
  productIds: string[];
  productCount: number;
  sections: RoundupSection[];
  faqs: RoundupFaq[];
};

export const allProducts = [...products] as Product[];
export const allRoundups = [...roundups] as Roundup[];

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

export const getTrendingProducts = () => allProducts.filter((product) => product.isTrending);

export const getProductsUnderPrice = (price: number) =>
  allProducts.filter((product) => product.price <= price);

export const getProductsByCategory = (category: ProductCategory) =>
  allProducts.filter((product) => product.category === category);

export const getProductById = (id: string) => allProducts.find((product) => product.id === id);

export const getRoundupBySlug = (slug: string) =>
  allRoundups.find((roundup) => roundup.slug === slug);

export const getProductsForRoundup = (roundup: Roundup) =>
  roundup.productIds
    .map((id) => getProductById(id))
    .filter((product): product is Product => Boolean(product));

export const getRoundupsByCategory = (category: ProductCategory) =>
  allRoundups.filter((roundup) => roundup.category === category);

export const sortProductsByPrice = (collection: Product[]) =>
  [...collection].sort((a, b) => a.price - b.price);
