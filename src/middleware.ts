import createMiddleware from 'next-intl/middleware';
import { locales, localePrefix } from './navigation';
 
export default createMiddleware({
  defaultLocale: 'es',
  locales,
  localePrefix
});
 
export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(es|en)/:path*']
};
