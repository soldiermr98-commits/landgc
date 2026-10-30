import { links } from '../config/site';

export const hero = {
  eyebrow: ['توسعه فناوری', 'محصولات نرم‌افزاری', 'راهکارهای دیجیتال'],
  /** Rendered as: «گیلاکلیک؛ از ایده تا توسعه راهکارهای دیجیتال» */
  title: {
    brand: 'گیلاکلیک؛',
    middle: 'از ایده تا توسعه',
    accent: 'راهکارهای دیجیتال',
  },
  lead: 'از طراحی و توسعه وب‌سایت تا تولید افزونه‌ها و ابزارهای نرم‌افزاری؛ راهکارهای کاربردی برای ساخت، مدیریت و توسعه کسب‌وکار آنلاین شما.',
  primary: { label: 'مشاهده محصولات نرم‌افزاری', href: links.anchors.products },
  secondary: { label: 'آشنایی با خدمات وب', href: links.anchors.services },
  note: 'بیش از ۱۰ سال تجربه در طراحی و توسعه وب',
} as const;
