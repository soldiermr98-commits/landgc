import type { IconName } from '../lib/icons';

export const processSection = {
  eyebrow: 'مسیر همکاری',
  title: 'شروع همکاری با گیلاکلیک ساده است',
} as const;

export const processSteps: { icon: IconName; title: string; text: string }[] = [
  { icon: 'target', title: 'انتخاب نیاز', text: 'نیاز یا مسئله خود را مشخص کنید.' },
  {
    icon: 'compass',
    title: 'انتخاب راهکار',
    text: 'از میان محصولات آماده یا خدمات تخصصی، راهکار مناسب را انتخاب کنید.',
  },
  { icon: 'rocket', title: 'اجرا و راه‌اندازی', text: 'محصول یا خدمت موردنظر را دریافت و راه‌اندازی کنید.' },
  { icon: 'headset', title: 'پشتیبانی و توسعه', text: 'برای استفاده بهتر و توسعه امکانات در کنار شما هستیم.' },
];
