import { PublicPageLayout } from "@/components/layout/public-page-layout";
import { Container } from "@/components/shared/container";
import type {
  AboutCmsPage as AboutCmsPageData,
  AboutCmsPlugin,
  AboutVideoPlugin,
} from "@/services/about-service";

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value, "http://localhost");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return value;
  } catch {
    return null;
  }
}

function videoSource(plugin: AboutVideoPlugin) {
  const safeUrl = safeHttpUrl(plugin.video_url);
  if (!safeUrl) return null;

  const url = new URL(safeUrl);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const autoplay = plugin.autoplay ? "1" : "0";

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id
      ? { kind: "embed" as const, url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplay}` }
      : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1);
    return id
      ? { kind: "embed" as const, url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplay}` }
      : null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).at(-1);
    return id
      ? { kind: "embed" as const, url: `https://player.vimeo.com/video/${id}?autoplay=${autoplay}` }
      : null;
  }

  if (host === "aparat.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const hash = parts[0] === "v" ? parts[1] : null;
    return hash
      ? {
          kind: "embed" as const,
          url: `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame`,
        }
      : { kind: "link" as const, url: safeUrl };
  }

  if (/\.(mp4|webm|ogg)(?:$|\?)/i.test(safeUrl)) {
    return { kind: "file" as const, url: safeUrl };
  }

  return { kind: "link" as const, url: safeUrl };
}

function sectionTitle(heading: string, intro: string) {
  return (
    <div className="mb-8 text-right">
      <h2 className="text-3xl font-black text-[#062452]">{heading}</h2>
      {intro ? <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600">{intro}</p> : null}
    </div>
  );
}

function CmsPlugin({ plugin }: { plugin: AboutCmsPlugin }) {
  switch (plugin.plugin_type) {
    case "AboutHeroPlugin": {
      const background = safeHttpUrl(plugin.background_image);
      const cta = safeHttpUrl(plugin.cta_url);
      return (
        <section className="relative overflow-hidden border-b border-slate-200 bg-[#062452] text-white">
          {background ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={background}
                alt={plugin.image_alt}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-[#062452]/95 to-[#062452]/60" />
            </>
          ) : null}
          <Container className="relative py-16 md:py-24">
            <div className="max-w-3xl text-right">
              {plugin.eyebrow ? <p className="mb-4 text-sm font-black text-blue-200">{plugin.eyebrow}</p> : null}
              <h1 className="text-3xl font-black leading-[1.45] md:text-5xl">{plugin.title}</h1>
              {plugin.subtitle ? <p className="mt-5 text-base leading-9 text-blue-50 md:text-lg">{plugin.subtitle}</p> : null}
              {cta && plugin.cta_label ? (
                <a
                  href={cta}
                  className="mt-7 inline-flex rounded-2xl bg-white px-6 py-3 text-sm font-black text-[#062452] transition hover:bg-blue-50"
                >
                  {plugin.cta_label}
                </a>
              ) : null}
            </div>
          </Container>
        </section>
      );
    }
    case "AboutRichTextPlugin":
      return (
        <section className="bg-white py-14 md:py-16">
          <Container>
            <article className="rounded-[2rem] border border-slate-200 bg-white p-8 text-right shadow-sm">
              {plugin.heading ? <h2 className="mb-6 text-2xl font-black text-[#062452]">{plugin.heading}</h2> : null}
              <div
                className="besat-rich-content"
                dangerouslySetInnerHTML={{ __html: plugin.body_html }}
              />
            </article>
          </Container>
        </section>
      );
    case "AboutHistoryPlugin":
      return (
        <section className="bg-[#f8fafc] py-14 md:py-16">
          <Container>
            {sectionTitle(plugin.heading, plugin.intro)}
            <div className="grid gap-4">
              {plugin.items.map((item, index) => (
                <div key={String(item.id ?? `${item.title}-${index}`)} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-sm md:grid-cols-[8rem_1fr]">
                  <p className="text-lg font-black text-blue-700">{item.year}</p>
                  <div>
                    <h3 className="font-black text-[#062452]">{item.title}</h3>
                    {item.description ? <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>
      );
    case "AboutFoundersPlugin":
      return (
        <section className="bg-white py-14 md:py-16">
          <Container>
            {sectionTitle(plugin.heading, plugin.intro)}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {plugin.items.map((item, index) => {
                const image = safeHttpUrl(item.image);
                return (
                  <article key={String(item.id ?? `${item.full_name}-${index}`)} className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-right shadow-sm">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt={item.image_alt || item.full_name} className="h-56 w-full object-cover" />
                    ) : null}
                    <div className="p-6">
                      <h3 className="text-lg font-black text-[#062452]">{item.full_name}</h3>
                      {item.role ? <p className="mt-1 text-sm font-bold text-blue-700">{item.role}</p> : null}
                      {item.bio ? <p className="mt-3 text-sm leading-7 text-slate-600">{item.bio}</p> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </Container>
        </section>
      );
    case "AboutValuesPlugin":
      return (
        <section className="bg-[#f8fafc] py-14 md:py-16">
          <Container>
            {sectionTitle(plugin.heading, plugin.intro)}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plugin.items.map((item, index) => (
                <article key={String(item.id ?? `${item.title}-${index}`)} className="rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-sm">
                  {item.icon ? <span className="text-2xl" aria-hidden="true">{item.icon}</span> : null}
                  <h3 className="mt-3 text-lg font-black text-[#062452]">{item.title}</h3>
                  {item.description ? <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p> : null}
                </article>
              ))}
            </div>
          </Container>
        </section>
      );
    case "AboutGoalsPlugin":
      return (
        <section className="bg-white py-14 md:py-16">
          <Container>
            {sectionTitle(plugin.heading, plugin.intro)}
            <div className="grid gap-4 md:grid-cols-2">
              {plugin.items.map((item, index) => (
                <article key={String(item.id ?? `${item.title}-${index}`)} className="rounded-3xl border border-blue-100 bg-blue-50/50 p-6 text-right">
                  <h3 className="font-black text-[#062452]">{item.title}</h3>
                  {item.description ? <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p> : null}
                </article>
              ))}
            </div>
          </Container>
        </section>
      );
    case "AboutGalleryPlugin":
      return (
        <section className="bg-[#f8fafc] py-14 md:py-16">
          <Container>
            {sectionTitle(plugin.heading, plugin.intro)}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plugin.items.map((item, index) => {
                const image = safeHttpUrl(item.image);
                if (!image) return null;
                return (
                  <figure key={String(item.id ?? `${item.alt_text}-${index}`)} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={item.alt_text} className="h-64 w-full object-cover" loading="lazy" />
                    {item.caption ? <figcaption className="p-4 text-right text-sm font-bold text-slate-600">{item.caption}</figcaption> : null}
                  </figure>
                );
              })}
            </div>
          </Container>
        </section>
      );
    case "AboutVideoPlugin": {
      const source = videoSource(plugin);
      if (!source) return null;
      return (
        <section className="bg-white py-14 md:py-16">
          <Container>
            {sectionTitle(plugin.heading || "ویدئو", plugin.caption)}
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-black shadow-sm">
              {source.kind === "embed" ? (
                <iframe
                  src={source.url}
                  title={plugin.heading || "ویدئوی درباره ما"}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              ) : source.kind === "file" ? (
                <video
                  src={source.url}
                  poster={safeHttpUrl(plugin.poster) ?? undefined}
                  controls
                  autoPlay={plugin.autoplay}
                  muted={plugin.autoplay}
                  className="aspect-video w-full"
                />
              ) : (
                <a href={source.url} className="block p-8 text-center font-black text-white underline" target="_blank" rel="noreferrer">
                  مشاهده ویدئو
                </a>
              )}
            </div>
          </Container>
        </section>
      );
    }
  }
}

export function AboutCmsPage({ page }: { page: AboutCmsPageData }) {
  return (
    <PublicPageLayout>
      {page.plugins.map((plugin, index) => (
        <CmsPlugin key={`${plugin.plugin_type}-${String(plugin.id ?? index)}`} plugin={plugin} />
      ))}
    </PublicPageLayout>
  );
}
