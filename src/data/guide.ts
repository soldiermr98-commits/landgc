import { links } from '../config/site';
import type { IconName } from '../lib/icons';

export interface GuideCategory {
  id: string;
  title: string;
  href: string;
  icon: IconName;
  /** Real photo from GilaClick's own media library. */
  image: { src: string; width: number; height: number; alt: string };
  /** What the photo actually shows. */
  caption: string;
}

export const guideSection = {
  eyebrow: 'راهنمای جامع گیلان',
  title: 'گیلان را بهتر بشناسید؛ کسب‌وکارها و جاذبه‌های اطراف شما',
  description:
    'گیلاکلیک بستری برای معرفی ظرفیت‌های گردشگری، خدماتی و تجاری استان گیلان است. از پیدا کردن یک رستوران و اقامتگاه تا آشنایی با کسب‌وکارها و جاذبه‌های دیدنی این استان.',
  cta: { label: 'ورود به راهنمای جامع گیلان', href: links.guide.hub },
} as const;

/** Percent-encodes the Persian file names (UTF-8), exactly as browsers request them. */
const media = (file: string) => encodeURI(`https://gilaclick.ir/wp-content/uploads/${file}`);

/**
 * Photos were chosen from gilaclick.ir's media library after checking each one is a real
 * photograph (an AI-generated «shopping mall» image in the library was deliberately skipped).
 */
export const guideCategories: GuideCategory[] = [
  {
    id: 'attractions',
    title: 'جاذبه‌های گردشگری',
    href: links.guide.attractions,
    icon: 'trees',
    image: {
      src: media('2025/01/پارک-جنگلی-سراوان_GilaClick.webp'),
      width: 1523,
      height: 761,
      alt: 'مسیر چوبی و برکه سبز در پارک جنگلی سراوان گیلان',
    },
    caption: 'پارک جنگلی سراوان',
  },
  {
    id: 'cafes',
    title: 'رستوران‌ها و کافه‌ها',
    href: links.guide.cafes,
    icon: 'coffee',
    image: {
      src: media('2025/02/کافه-آدرس-رشت.webp'),
      width: 750,
      height: 500,
      alt: 'فضای داخلی کافه آدرس در رشت با دیوار آجری و میزهای چوبی',
    },
    caption: 'کافه آدرس، رشت',
  },
  {
    id: 'stays',
    title: 'اقامتگاه‌ها',
    href: links.guide.stays,
    icon: 'house',
    image: {
      src: media('2025/01/خانه-موزه-میرزا-کوچک-خان-جنگلی-GilaClick.webp'),
      width: 1475,
      height: 688,
      alt: 'خانه موزه میرزا کوچک خان جنگلی در رشت؛ نمونه معماری بومی خانه‌های گیلانی با ایوان چوبی',
    },
    caption: 'خانه موزه میرزا کوچک خان، رشت',
  },
  {
    id: 'business',
    title: 'فروشگاه‌ها و کسب‌وکارها',
    href: links.guide.business,
    icon: 'store',
    image: {
      src: media('2025/01/بازار-بزرگ-رشت_GilaClick.webp'),
      width: 764,
      height: 500,
      alt: 'ورودی بازار بزرگ رشت با غرفه‌های میوه و سبزی',
    },
    caption: 'بازار بزرگ رشت',
  },
];
