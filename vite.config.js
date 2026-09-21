import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import { getRenewableNews } from './lib/news-feed.js'

const localNewsApi = () => ({
  name: 'local-news-api',
  configureServer(server) {
    server.middlewares.use('/api/news', async (_request, response) => {
      try {
        const news = await getRenewableNews()
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ news, updatedAt: new Date().toISOString() }))
      } catch {
        response.statusCode = 503
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ news: [], error: 'Notícias temporariamente indisponíveis.' }))
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const { VITE_SITE_URL = '' } = loadEnv(mode, process.cwd(), 'VITE_SITE_URL')
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const configuredUrl = VITE_SITE_URL.trim() || (productionHost ? `https://${productionHost}` : '')
  const siteUrl = configuredUrl ? new URL(configuredUrl).origin : ''
  if (siteUrl && !siteUrl.startsWith('https://')) throw new Error('VITE_SITE_URL precisa usar HTTPS.')
  const seo = {
    name: 'production-seo',
    transformIndexHtml() {
      const previewTags = process.env.VERCEL_ENV === 'preview' ? [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex,nofollow' }, injectTo: 'head' }] : []
      if (!siteUrl) return previewTags
      return [...previewTags,
        { tag: 'link', attrs: { rel: 'canonical', href: `${siteUrl}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: `${siteUrl}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image', content: `${siteUrl}/images/solar-hero.webp` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: 'Painéis solares em uma cobertura residencial' }, injectTo: 'head' },
      ]
    },
    generateBundle() {
      if (!siteUrl) return
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}/</loc></url></urlset>` })
    },
  }
  return { plugins: [react(), localNewsApi(), seo] }
})
