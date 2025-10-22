import createMiddleware from 'next-intl/middleware';
import { locales, localePrefix } from './navigation';
 
export default createMiddleware({
  defaultLocale: 'es',
  locales,
  localePrefix
});
 
export const config = {
  // Match only internationalized pathnames
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // Match all pathnames within `/` folder
    '/(es|en)/:path*'
  ]
};
