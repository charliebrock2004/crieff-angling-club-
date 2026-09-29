import { notFound } from "next/navigation";
import { Breadcrumbs } from "./breadcrumbs";
import { Markdown } from "@/lib/markdown";
import { getPage } from "@/lib/content/queries";

export async function CmsPage({ slug, path }: { slug: string; path: string }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <div className="container-club py-12 sm:py-16">
      <Breadcrumbs items={[{ href: path, label: page.title }]} />
      <h1 className="display-lg mt-6">{page.title}</h1>
      {page.intro && <p className="lede mt-4 max-w-2xl">{page.intro}</p>}
      <div className="mt-10"><Markdown source={page.body} /></div>
      <p className="mt-12 text-sm text-stone">Last updated {new Date(page.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
    </div>
  );
}
