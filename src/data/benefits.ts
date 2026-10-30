import type { IconName } from '../lib/icons';

export const benefitsSection = {
  eyebrow: 'مزایای همکاری',
  title: 'چرا گیلاکلیک؟',
} as const;

export const benefits: { icon: IconName; title: string; text: string }[] = [
  { icon: 'badge-check', title: 'تجربه و تخصص', text: 'بیش از یک دهه فعالیت در حوزه طراحی و توسعه وب.' },
  {
    icon: 'package-check',
    title: 'تولید محصولات اختصاصی',
    text: 'ابزارهایی که با شناخت نیازهای واقعی وب‌سایت‌ها توسعه داده می‌شوند.',
  },
  { icon: 'layers', title: 'خدمات یکپارچه', text: 'از طراحی و توسعه تا سئو، امنیت و پشتیبانی.' },
  {
    icon: 'handshake',
    title: 'همراهی پس از خرید',
    text: 'ارائه مستندات، آموزش، نصب و راه‌اندازی و پشتیبانی متناسب با محصول.',
  },
];
