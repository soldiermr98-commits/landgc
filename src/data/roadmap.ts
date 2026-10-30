import { links } from '../config/site';
import type { IconName } from '../lib/icons';

export const roadmapSection = {
  badge: 'در حال توسعه و برنامه‌های آینده',
  title: 'فراتر از وب‌سایت؛ توسعه ابزارهای هوشمند مدیریتی',
  description:
    'مسیر توسعه گیلاکلیک به تولید افزونه‌های کاربردی محدود نمی‌شود. توسعه سیستم‌های مدیریتی، نرم‌افزارهای تحت وب و اپلیکیشن‌های کاربردی نیز بخشی از برنامه آینده ماست.',
  listTitle: 'نمونه حوزه‌های توسعه',
  /** Makes explicit that none of these is an available product. */
  disclaimer: 'این موارد حوزه‌های برنامه توسعه هستند و هنوز به‌عنوان محصول عرضه نشده‌اند.',
  cta: { label: 'طرح نیاز یا پیشنهاد همکاری', href: links.contact },
} as const;

export const roadmap: { icon: IconName; title: string }[] = [
  { icon: 'chef-hat', title: 'سیستم مدیریت کافه و رستوران' },
  { icon: 'clipboard-list', title: 'سامانه‌های مدیریت سفارش و مشتریان' },
  { icon: 'workflow', title: 'ابزارهای اتوماسیون کسب‌وکار' },
  { icon: 'layout-dashboard', title: 'نرم‌افزارهای مدیریتی و کاربردی' },
];
