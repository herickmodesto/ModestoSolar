const FEEDS = [
  { url: "https://www.absolar.org.br/feed/", source: "ABSOLAR" },
  { url: "https://www.pv-magazine-brasil.com/feed/", source: "pv magazine Brasil" },
];

const TOPIC_PATTERN = /solar|fotovolta|energia|renov|bateria|armazenamento|gera[cç][aã]o|transi[cç][aã]o energ[eé]tica|mercado livre/i;

function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeEntities(match?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseFeed(xml, source) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, item]) => {
    const title = readTag(item, "title");
    const description = readTag(item, "description");
    const categories = [...item.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map(match => decodeEntities(match[1])).join(" ");
    return {
      title,
      description,
      url: readTag(item, "link"),
      publishedAt: readTag(item, "pubDate"),
      source,
      relevantText: `${title} ${description} ${categories}`,
    };
  }).filter(item => item.title && item.url && TOPIC_PATTERN.test(item.relevantText));
}

async function findArticleImage(articleUrl) {
  try {
    const response = await fetch(articleUrl, { headers: { "user-agent": "Modesto-Energias-News/1.0" }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const html = await response.text();
    const propertyFirst = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const contentFirst = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
    return decodeEntities(propertyFirst?.[1] || contentFirst?.[1] || "") || null;
  } catch {
    return null;
  }
}

export async function getRenewableNews() {
  const feedResults = await Promise.allSettled(FEEDS.map(async feed => {
    const response = await fetch(feed.url, { headers: { "user-agent": "Modesto-Energias-News/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Feed indisponível: ${feed.source}`);
    return parseFeed(await response.text(), feed.source);
  }));
  const unique = new Map();
  feedResults.flatMap(result => result.status === "fulfilled" ? result.value : []).forEach(item => unique.set(item.url, item));
  const latest = [...unique.values()].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 8);
  const withImages = await Promise.all(latest.map(async (item, index) => ({
    title: item.title,
    description: item.description,
    url: item.url,
    source: item.source,
    publishedAt: item.publishedAt,
    image: await findArticleImage(item.url) || `/images/${index % 2 ? "noticia-agrivoltaico.jpeg" : "noticia-setor-solar.jpeg"}`,
  })));
  if (!withImages.length) throw new Error("Nenhuma notícia renovável disponível");
  return withImages;
}
