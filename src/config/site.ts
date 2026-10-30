/**
 * Site configuration — the single source of truth for brand details, URLs and store settings.
 *
 * Every URL below was checked against the live site (https://gilaclick.ir) on 2026-10-30.
 * Items marked «TODO(page)» point to the closest real page because a dedicated page does
 * not exist yet; change them here once those pages are published.
 */

export const SITE_URL = 'https://gilaclick.ir';

/** Absolute URL on the main site (WordPress encodes Persian slugs; `URL` does the same). */
const url = (path: string): string => new URL(path, SITE_URL).href;

export const site = {
  name: 'گیلاکلیک',
  nameLatin: 'GilaClick',
  url: `${SITE_URL}/`,
  locale: 'fa_IR',
  title: 'گیلاکلیک | محصولات نرم‌افزاری، طراحی و توسعه وب و راهنمای گیلان',
  description:
    'گیلاکلیک؛ از ایده تا توسعه راهکارهای دیجیتال. افزونه‌های وردپرس و ووکامرس و محصولات نرم‌افزاری، طراحی سایت، سئو، پشتیبانی و برنامه‌نویسی اختصاصی، به‌همراه راهنمای جامع گیلان.',
  themeColor: '#06271F',
  /** Official raster logo from the WordPress media library (used for structured data). */
  officialLogo: url('/wp-content/uploads/2025/09/logo-gilaclick.webp'),
} as const;

export const links = {
  home: url('/'),
  shop: url('/shop/'),
  shopPlugins: url('/product-category/plugins/'),
  cart: url('/cart/'),
  account: url('/my-account/'),
  downloads: url('/my-account/downloads/'),
  about: url('/about-us/'),
  contact: url('/contact-us/'),
  faq: url('/faq/'),
  blog: url('/blog/'),
  searchTemplate: `${SITE_URL}/?s={search_term_string}`,

  guide: {
    /** Category «معرفی گیلان» — the hub of the Gilan guide. */
    hub: url('/category/معرفی-گیلان/'),
    cafes: url('/category/caferestaurant/'),
    attractions: url('/category/معرفی-گیلان/'),
    business: url('/category/business/'),
    /** TODO(page): no accommodation category exists yet — site search for «اقامتگاه». */
    stays: url('/?s=اقامتگاه'),
  },

  /** Service call-to-actions. TODO(page): no dedicated service / pricing pages exist yet. */
  services: {
    webDesign: url('/contact-us/'),
    seo: url('/contact-us/'),
    support: url('/contact-us/'),
    consultation: url('/contact-us/'),
  },

  /** In-page anchors (section ids on this homepage). */
  anchors: {
    products: '#products',
    services: '#services',
    serviceWeb: '#service-web',
    serviceSeo: '#service-seo',
    serviceSupport: '#service-support',
    serviceDev: '#service-dev',
  },
} as const;

/**
 * WooCommerce Store API settings for the products section.
 * Prices, names, images and links always come from the live store — nothing is hardcoded.
 */
export const store = {
  /** Same-origin by default. Override with PUBLIC_STORE_API when hosting elsewhere. */
  apiBase: (import.meta.env.PUBLIC_STORE_API as string | undefined) ?? '/wp-json/wc/store/v1',
  /** Maximum number of products requested for the homepage. */
  perPage: 6,
  /** Request timeout in milliseconds. */
  timeoutMs: 9000,
  /**
   * Featured product: a product starred as «featured» in WooCommerce always wins.
   * Otherwise this id is used (from the brief: «افزونه ووکامرس حامی | Call For Price»),
   * and if it no longer exists, the newest product.
   */
  preferredFeaturedId: 5289,
  /**
   * Card summaries used ONLY while a product's WooCommerce «short description» is empty.
   * Fill the short description in WooCommerce and it replaces these automatically.
   */
  summaries: {
    5289: 'مدیریت استعلام قیمت محصولات و تغییر گروهی قیمت‌ها در ووکامرس با امکانات کاربردی و تنظیمات انعطاف‌پذیر.',
    5290: 'دستیار هوشمند فروش با قابلیت جستجوی معنایی محصولات، پاسخ‌گویی به کاربران و کمک به افزایش تعامل مشتریان با فروشگاه.',
  } as Record<number, string>,
} as const;

/**
 * Public contact details. Left empty on purpose: no public phone, e-mail or address is
 * published on gilaclick.ir today, and inventing one is not acceptable.
 * Anything filled in here appears in the footer automatically.
 */
export const contact = {
  formUrl: links.contact,
  email: '',
  phone: '',
  /** Display form of the phone number, e.g. '۰۱۳-۱۲۳۴۵۶۷۸'. */
  phoneLabel: '',
  address: '',
} as const;

export type SocialNetwork = 'telegram' | 'instagram' | 'whatsapp' | 'aparat' | 'youtube' | 'x' | 'github';

export interface SocialLink {
  network: SocialNetwork;
  /** Accessible label, e.g. «اینستاگرام گیلاکلیک». */
  label: string;
  url: string;
}

/** Official social profiles. Add entries here once the accounts are public. */
export const social: SocialLink[] = [];
