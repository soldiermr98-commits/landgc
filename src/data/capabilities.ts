import type { IconName } from '../lib/icons';

export const capabilitiesSection = {
  eyebrow: 'توانمندی‌ها و تجربه',
  title: 'تجربه فنی، از طراحی تا توسعه راهکارهای دیجیتال',
  paragraphs: [
    'بیش از ۱۰ سال فعالیت در زمینه طراحی و توسعه وب، شناخت دقیقی از نیازهای فنی وب‌سایت‌ها و کسب‌وکارهای آنلاین در اختیار ما قرار داده است.',
    'در گیلاکلیک تلاش می‌کنیم به‌جای ارائه راهکارهای تکراری، ابزارها و خدماتی کاربردی، قابل توسعه و متناسب با نیاز واقعی هر پروژه ارائه کنیم.',
  ],
} as const;

/** Qualitative capabilities only — no invented statistics. */
export const capabilities: { icon: IconName; label: string }[] = [
  { icon: 'calendar-clock', label: 'بیش از ۱۰ سال تجربه در حوزه وب' },
  { icon: 'blocks', label: 'توسعه محصولات نرم‌افزاری اختصاصی' },
  { icon: 'gauge', label: 'تمرکز بر کیفیت فنی و تجربه کاربری' },
  { icon: 'life-buoy', label: 'ارائه خدمات نصب، آموزش و پشتیبانی' },
];

/** Labels around the chip illustration (technologies named in the brief). */
export const stack = ['WordPress', 'WooCommerce', 'PHP', 'REST API'] as const;
