import {getRequestConfig} from 'next-intl/server';
import {locales} from './src/navigation';
import {notFound} from 'next/navigation';

// Statically import messages
import enMessages from './messages/en.json';
import esMessages from './messages/es.json';

const messages = {
  en: enMessages,
  es: esMessages,
};
 
export default getRequestConfig(async ({locale}) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as any)) {
    notFound();
  }

  return {
    messages: messages[locale as keyof typeof messages]
  };
});
