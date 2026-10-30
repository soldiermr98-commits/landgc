import { links } from '../config/site';

export const finalCta = {
  title: 'برای قدم بعدی کسب‌وکار دیجیتال خود آماده‌اید؟',
  description:
    'چه به دنبال یک ابزار نرم‌افزاری کاربردی باشید، چه قصد طراحی سایت جدید یا توسعه امکانات کسب‌وکار آنلاین خود را داشته باشید، گیلاکلیک می‌تواند نقطه شروع مناسبی برای شما باشد.',
  primary: { label: 'مشاهده فروشگاه محصولات', href: links.shop },
  secondary: { label: 'درخواست مشاوره و ثبت پروژه', href: links.contact },
} as const;
