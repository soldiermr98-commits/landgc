import { links } from '../config/site';
import type { IconName } from '../lib/icons';

export interface Service {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  items: string[];
  cta: { label: string; href: string };
}

export const servicesSection = {
  eyebrow: 'خدمات تخصصی وب',
  title: 'راهکارهای تخصصی برای حضور قدرتمند در فضای دیجیتال',
  description:
    'از راه‌اندازی یک وب‌سایت حرفه‌ای تا بهینه‌سازی، توسعه و نگهداری آن؛ خدمات موردنیاز کسب‌وکار شما را در یک مسیر یکپارچه ارائه می‌کنیم.',
} as const;

export const services: Service[] = [
  {
    id: 'service-web',
    icon: 'layout-template',
    title: 'طراحی و توسعه وب‌سایت',
    description: 'طراحی سایت‌های مدرن، سریع و اختصاصی متناسب با نیاز کسب‌وکار شما.',
    items: [
      'طراحی سایت شرکتی و خدماتی',
      'طراحی فروشگاه اینترنتی',
      'طراحی سایت اختصاصی',
      'طراحی سامانه‌های رزرو و نوبت‌دهی',
    ],
    cta: { label: 'مشاهده خدمات و تعرفه طراحی سایت', href: links.services.webDesign },
  },
  {
    id: 'service-seo',
    icon: 'search-check',
    title: 'سئو و بهینه‌سازی سایت',
    description: 'بهبود ساختار سایت و افزایش شانس دیده‌شدن در نتایج جستجوی گوگل.',
    items: ['سئو تکنیکال', 'سئو داخلی', 'تحقیق کلمات کلیدی', 'استراتژی محتوا', 'بهینه‌سازی فروشگاه اینترنتی'],
    cta: { label: 'مشاهده خدمات سئو', href: links.services.seo },
  },
  {
    id: 'service-support',
    icon: 'shield-check',
    title: 'پشتیبانی و نگهداری وب‌سایت',
    description: 'حفظ امنیت، سلامت و عملکرد وب‌سایت با خدمات نگهداری منظم.',
    items: [
      'افزایش امنیت سایت',
      'بکاپ‌گیری منظم',
      'بروزرسانی وردپرس و افزونه‌ها',
      'رفع خطاهای فنی',
      'بررسی عملکرد و سلامت سایت',
    ],
    cta: { label: 'مشاهده تعرفه پشتیبانی', href: links.services.support },
  },
  {
    id: 'service-dev',
    icon: 'code-xml',
    title: 'برنامه‌نویسی و توسعه اختصاصی',
    description: 'توسعه قابلیت‌ها و ابزارهای نرم‌افزاری متناسب با نیازهای خاص کسب‌وکارها.',
    items: [
      'توسعه افزونه وردپرس',
      'برنامه‌نویسی PHP',
      'سفارشی‌سازی ووکامرس',
      'توسعه ماژول‌های اختصاصی',
      'اتصال API و سرویس‌های خارجی',
    ],
    cta: { label: 'درخواست مشاوره فنی', href: links.services.consultation },
  },
];
