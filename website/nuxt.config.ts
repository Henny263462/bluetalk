const baseURL = process.env.NUXT_APP_BASE_URL || '/'

const colorSchemeInit = `;(function(){var k='bluetalk-site-color-scheme';var d=document.documentElement;try{var v=localStorage.getItem(k);var light=v==='light'||(v!=='dark'&&window.matchMedia('(prefers-color-scheme: light)').matches);d.dataset.colorScheme=light?'light':'dark';d.style.colorScheme=light?'light':'dark';}catch(e){d.dataset.colorScheme='dark';d.style.colorScheme='dark';}})();`

export default defineNuxtConfig({
  app: {
    baseURL,
    head: {
      titleTemplate: '%s · BlueTalk',
      script: [
        {
          innerHTML: colorSchemeInit,
          tagPosition: 'head',
        },
      ],
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          name: 'description',
          content: 'Peer-to-peer messaging built for silence. No servers, no accounts, no traces.',
        },
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
      routes: ['/', '/features'],
    },
  },
  routeRules: {
    '/': { prerender: true },
    '/features': { prerender: true },
    // Needs live /api/releases/* — avoid baking empty release data at generate time
    '/download': { prerender: false },
  },
})
