import { getRenewableNews } from "../lib/news-feed.js";

export default async function handler(_request, response) {
  try {
    const news = await getRenewableNews();
    response.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=86400");
    response.status(200).json({ news, updatedAt: new Date().toISOString() });
  } catch {
    response.setHeader("Cache-Control", "public, s-maxage=900");
    response.status(503).json({ news: [], error: "Não foi possível atualizar as notícias agora." });
  }
}
