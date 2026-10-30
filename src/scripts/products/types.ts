/** Subset of the WooCommerce Store API product schema used on the homepage. */
export interface StoreImage {
  src: string;
  srcset?: string;
  sizes?: string;
  alt?: string;
  name?: string;
}

export interface StorePrices {
  price: string;
  regular_price: string;
  sale_price: string;
  price_range: { min_amount: string; max_amount: string } | null;
  currency_code?: string;
  currency_symbol?: string;
  currency_minor_unit: number;
  currency_prefix?: string;
  currency_suffix?: string;
}

export interface StoreProduct {
  id: number;
  name: string;
  permalink: string;
  type?: string;
  short_description?: string;
  description?: string;
  on_sale?: boolean;
  prices?: StorePrices;
  images?: StoreImage[];
  categories?: { id: number; name: string; link?: string }[];
  is_purchasable?: boolean;
  is_in_stock?: boolean;
}

export interface ProductsConfig {
  apiBase: string;
  perPage: number;
  timeoutMs: number;
  preferredFeaturedId: number | null;
  summaries: Record<string, string>;
  cartUrl: string;
  copy: {
    unavailable: { title: string; body: string };
    empty: { title: string; body: string };
  };
}

export type PriceView =
  | { kind: 'single'; value: number; amount: string; regular?: string; unit: string; prefix: string }
  | { kind: 'range'; min: string; max: string; unit: string; prefix: string }
  | { kind: 'inquiry' };

export interface ProductView {
  id: number;
  name: string;
  url: string;
  category: string;
  image: { src: string; srcset: string; alt: string } | null;
  summary: string;
  highlights: string[];
  price: PriceView;
  addToCartUrl: string | null;
}
