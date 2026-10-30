import { links } from '../config/site';

export const productsSection = {
  eyebrow: 'ابزارهایی برای توسعه و مدیریت بهتر',
  title: 'محصولات نرم‌افزاری گیلاکلیک',
  description:
    'مجموعه‌ای از افزونه‌ها، ابزارها و نرم‌افزارهای کاربردی که با هدف رفع نیازهای واقعی وب‌سایت‌ها و کسب‌وکارهای آنلاین توسعه داده شده‌اند.',
  cardCta: 'مشاهده جزئیات محصول',
  allProducts: { label: 'مشاهده همه محصولات', href: links.shop },

  /** Not a store product: an entry point for custom software (no price, links to consultation). */
  custom: {
    label: 'راهکار اختصاصی',
    title: 'ابزارهای مدیریتی و نرم‌افزارهای اختصاصی',
    description: 'راهکارهای نرم‌افزاری برای ساده‌سازی فرایندهای کاری و مدیریت بهتر کسب‌وکارها.',
    cta: { label: 'درخواست مشاوره فنی', href: links.services.consultation },
  },

  /** Shown only if the Store API cannot be reached. Never replaced with made-up products. */
  unavailable: {
    title: 'نمایش زنده محصولات در این لحظه ممکن نشد',
    body: 'فهرست کامل محصولات و قیمت‌های به‌روز همیشه در فروشگاه گیلاکلیک در دسترس است.',
    cta: 'رفتن به فروشگاه',
  },
  empty: {
    title: 'محصولات تازه به‌زودی اضافه می‌شوند',
    body: 'برای مشاهده آخرین وضعیت فروشگاه، صفحه فروشگاه را ببینید.',
  },
} as const;
