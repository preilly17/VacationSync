import { load } from "cheerio";

export interface LinkPreviewMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const normalizeUrl = (rawUrl: string): string => {
  if (!rawUrl) {
    throw new Error("URL is required");
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }

  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const candidate = hasProtocol ? trimmed : `https://${trimmed}`;

  const parsed = new URL(candidate);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  return parsed.toString();
};

const getHostname = (url: string): string | undefined => {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./i, "");
  } catch {
    return undefined;
  }
};

export async function unfurlLinkMetadata(rawUrl: string): Promise<LinkPreviewMetadata> {
  const normalizedUrl = normalizeUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      redirect: "follow",
    });

    const finalUrl = response.url || normalizedUrl;
    const baseMetadata: LinkPreviewMetadata = {
      url: finalUrl,
      siteName: getHostname(finalUrl),
    };

    if (!response.ok) {
      return baseMetadata;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return baseMetadata;
    }

    const html = await response.text();
    const $ = load(html);

    const getMeta = (selector: string) => $(selector).attr("content")?.trim();
    const pickMeta = (name: string) =>
      getMeta(`meta[property='${name}']`) || getMeta(`meta[name='${name}']`);

    const title =
      pickMeta("og:title") ||
      $("title").first().text()?.trim() ||
      undefined;

    const description =
      pickMeta("og:description") ||
      getMeta("meta[name='description']") ||
      undefined;

    const image = pickMeta("og:image") || undefined;
    const siteName = pickMeta("og:site_name") || baseMetadata.siteName;

    return {
      url: finalUrl,
      title,
      description,
      image,
      siteName,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { url: normalizedUrl, siteName: getHostname(normalizedUrl) };
    }
    return { url: normalizedUrl, siteName: getHostname(normalizedUrl) };
  } finally {
    clearTimeout(timeout);
  }
}
