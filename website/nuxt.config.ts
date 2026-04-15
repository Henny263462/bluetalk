const baseURL = process.env.NUXT_APP_BASE_URL || '/'

export default defineNuxtConfig({
  app: {
    baseURL,
    head: {
      titleTemplate: '%s · BlueTalk',
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          name: 'description',
          content: 'Peer-to-peer messaging built for silence. No servers, no accounts, no traces.',
        },
        { name: 'theme-color', content: '#0a0a0a' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg` },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/download'],
    },
  },
  routeRules: {
    '/': { prerender: true },
    '/download': { prerender: true },
  },
})
