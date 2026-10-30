import { links } from './site';
import type { IconName } from '../lib/icons';

export interface NavLeaf {
  label: string;
  href: string;
  description?: string;
  icon?: IconName;
}

export interface NavGroup {
  label: string;
  /** Id used for the disclosure panel. */
  id: string;
  children: NavLeaf[];
  /** Highlighted link at the bottom of the panel. */
  footer: NavLeaf;
}

export type NavItem = (NavLeaf & { current?: boolean }) | NavGroup;

export const isGroup = (item: NavItem): item is NavGroup => 'children' in item;

export const mainNav: NavItem[] = [
  { label: 'صفحه اصلی', href: links.home, current: true },
  {
    label: 'فروشگاه محصولات',
    id: 'nav-shop',
    children: [
      {
        label: 'همه محصولات',
        href: links.shop,
        description: 'فهرست کامل محصولات نرم‌افزاری و قیمت‌ها',
        icon: 'store',
      },
      {
        label: 'افزونه‌ها و ماژول‌ها',
        href: links.shopPlugins,
        description: 'افزونه‌های وردپرس و ووکامرس',
        icon: 'plug',
      },
      {
        label: 'دانلودهای من',
        href: links.downloads,
        description: 'دسترسی به فایل محصولات خریداری‌شده',
        icon: 'download',
      },
      {
        label: 'سبد خرید',
        href: links.cart,
        description: 'بررسی و تکمیل سفارش',
        icon: 'shopping-cart',
      },
    ],
    footer: { label: 'مشاهده فروشگاه محصولات', href: links.shop },
  },
  {
    label: 'خدمات وب',
    id: 'nav-services',
    children: [
      {
        label: 'طراحی و توسعه وب‌سایت',
        href: links.anchors.serviceWeb,
        description: 'سایت شرکتی، فروشگاهی و اختصاصی',
        icon: 'layout-template',
      },
      {
        label: 'سئو و بهینه‌سازی سایت',
        href: links.anchors.serviceSeo,
        description: 'سئو تکنیکال، داخلی و استراتژی محتوا',
        icon: 'search-check',
      },
      {
        label: 'پشتیبانی و نگهداری',
        href: links.anchors.serviceSupport,
        description: 'امنیت، بکاپ و بروزرسانی منظم',
        icon: 'shield-check',
      },
      {
        label: 'برنامه‌نویسی اختصاصی',
        href: links.anchors.serviceDev,
        description: 'افزونه، ماژول و اتصال API',
        icon: 'code-xml',
      },
    ],
    footer: { label: 'درخواست مشاوره فنی', href: links.services.consultation },
  },
  { label: 'راهنمای گیلان', href: links.guide.hub },
  { label: 'درباره ما', href: links.about },
  { label: 'تماس با ما', href: links.contact },
];

export interface FooterColumn {
  title: string;
  links: NavLeaf[];
}

/** Footer columns, in the order given by the brief. */
export const footerColumns: FooterColumn[] = [
  {
    title: 'دسترسی سریع',
    links: [
      { label: 'صفحه اصلی', href: links.home },
      { label: 'درباره ما', href: links.about },
      { label: 'تماس با ما', href: links.contact },
    ],
  },
  {
    title: 'فروشگاه',
    links: [
      { label: 'افزونه‌ها', href: links.shopPlugins },
      { label: 'ابزارهای وب', href: links.shop },
      { label: 'قالب‌ها و محصولات دیجیتال', href: links.shop },
    ],
  },
  {
    title: 'خدمات',
    links: [
      { label: 'طراحی سایت', href: links.anchors.serviceWeb },
      { label: 'سئو', href: links.anchors.serviceSeo },
      { label: 'پشتیبانی', href: links.anchors.serviceSupport },
      { label: 'توسعه اختصاصی', href: links.anchors.serviceDev },
    ],
  },
  {
    title: 'راهنمای گیلان',
    links: [
      { label: 'مشاغل', href: links.guide.business },
      { label: 'رستوران‌ها', href: links.guide.cafes },
      { label: 'گردشگری', href: links.guide.attractions },
      { label: 'اقامتگاه‌ها', href: links.guide.stays },
    ],
  },
];
