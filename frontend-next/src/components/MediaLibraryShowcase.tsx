import Image from "next/image";
import {
  ChevronDown,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  LayoutList,
  MessageCircle,
  PenLine,
  Plus,
  Search,
  Settings,
  Wrench,
} from "lucide-react";

const mediaRows = [
  {
    altState: "No alt text",
    imageAlt: "Mountain peaks reflected in an alpine lake",
  },
  {
    altState: "generated",
    imageAlt: "Mountain peaks reflected in an alpine lake",
  },
];

const sidebarItems = [
  { label: "Dashboard", icon: LayoutGrid },
  { label: "Posts", icon: PenLine },
  { label: "Media", icon: ImageIcon, active: true },
  { label: "Pages", icon: FileText },
  { label: "Comments", icon: MessageCircle },
  { label: "Plugins", icon: Wrench },
  { label: "Settings", icon: Settings },
];

export default function MediaLibraryShowcase() {
  return (
    <section aria-labelledby="media-library-showcase-title" className="bg-white pb-0 pt-12 sm:pb-4 sm:pt-16 lg:pb-8 lg:pt-20">
      <div className="mx-auto w-full max-w-[1900px] px-5 sm:px-8 lg:px-[4vw]">
        <div className="mx-auto max-w-4xl text-center">
          <h2
            id="media-library-showcase-title"
            className="font-outfit text-4xl font-bold tracking-[-0.055em] text-ink sm:text-5xl lg:text-[4.2rem] lg:leading-[1.04]"
          >
            From blank alt text to a clear description
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted sm:text-xl">
            Images with an empty alt field get a short, specific description you can edit in WordPress.
          </p>
        </div>

        <div className="relative mt-14 overflow-hidden rounded-[2rem] border border-line bg-white shadow-notebook-lg sm:mt-16 lg:mt-20 lg:rounded-[2.1rem]">
          <div className="flex min-h-[680px] flex-col lg:flex-row">
            <aside className="flex w-full shrink-0 flex-col border-b border-line bg-yellow-tint px-5 py-6 text-ink sm:px-7 lg:w-[230px] lg:border-b-0 lg:border-r lg:px-0 lg:py-8 lg:rounded-l-[2.1rem]">
              <div className="flex items-center px-1 lg:px-6">
                <div className="relative h-10 w-10 overflow-hidden rounded-full border border-line-strong bg-white">
                  <Image
                    src="/logos/wordpress.svg"
                    alt="WordPress"
                    width={176}
                    height={40}
                    className="absolute left-0 top-0 h-10 w-auto max-w-none"
                  />
                </div>
              </div>

              <nav aria-label="WordPress admin preview" className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:mt-10 lg:grid-cols-1 lg:gap-1">
                {sidebarItems.map(({ label, icon: Icon, active }) => (
                  <div
                    key={label}
                    className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors lg:mx-3 lg:px-3 ${
                      active ? "bg-brand-yellow font-semibold text-ink" : "text-ink-muted"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </div>
                ))}
              </nav>

              <span className="mt-auto hidden px-6 pt-12 text-xs text-ink-muted lg:block">Collapse menu</span>
            </aside>

            <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-11 lg:py-10">
              <div className="flex flex-col gap-7 border-b border-line pb-7 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
                <div className="flex flex-wrap items-center gap-5">
                  <h3 className="font-outfit text-3xl font-medium tracking-[-0.04em] text-ink sm:text-4xl">Media Library</h3>
                  <button type="button" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:bg-yellow-tint">
                    <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
                    Add New
                  </button>
                </div>
                <div className="flex w-full max-w-[420px] items-center justify-end gap-3 text-sm text-ink-muted">
                  <span className="shrink-0 whitespace-nowrap">Search media</span>
                  <div className="flex h-11 w-full min-w-0 max-w-[300px] flex-1 items-center rounded-xl border border-line-strong bg-white px-3">
                    <Search className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                    <span className="sr-only">Search media</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 py-7">
                <button type="button" aria-label="Grid view" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-white text-ink">
                  <LayoutGrid className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" aria-label="List view" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-white text-ink">
                  <LayoutList className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-white px-4 text-[15px] text-ink">
                  All media items
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-white px-4 text-[15px] text-ink">
                  All dates
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-line">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[2.2fr_0.8fr_1fr_1fr_1.5fr] items-center border-b border-line bg-yellow-tint px-5 py-5 text-sm font-semibold text-ink">
                    <span>File</span>
                    <span>Author</span>
                    <span>Uploaded to</span>
                    <span>Date</span>
                    <span>Alt Text</span>
                  </div>

                  {mediaRows.map((row, index) => (
                    <div key={row.altState} className="relative grid min-h-[190px] grid-cols-[2.2fr_0.8fr_1fr_1fr_1.5fr] items-center border-b border-line px-5 py-7 last:border-b-0">
                      <div className="flex items-center gap-4">
                        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-md bg-yellow-tint">
                          <Image src="/mountain-landscape.jpg" alt={row.imageAlt} fill sizes="112px" className="object-cover" />
                        </div>
                        <div>
                          <p className="text-base font-medium text-ink">mountain-lake.jpg</p>
                          <p className="mt-1 text-sm text-ink-muted">JPG</p>
                        </div>
                      </div>
                      <span className="text-base text-ink">You</span>
                      <span className="text-base text-ink underline decoration-line-strong underline-offset-4">Blog Post</span>
                      <span className="text-base text-ink">May 20, 2026</span>
                      {row.altState === "generated" ? (
                        <div className="max-w-[330px] rounded-xl border border-yellow-strong bg-yellow-tint px-4 py-4 text-sm text-ink">
                          <div className="font-semibold text-ink">Generated alt text</div>
                          <p className="mt-3 leading-6">Turquoise alpine lake reflecting sunlit mountain peaks and pine trees under a clear sky.</p>
                          <p className="mt-3 text-sm font-medium text-ink">Ready to review</p>
                        </div>
                      ) : (
                        <span className="w-fit rounded-lg border border-line-strong bg-yellow-tint px-3 py-2 text-sm text-ink-muted">No alt text</span>
                      )}

                      {index === 0 && (
                        <div className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-white px-7 py-4 shadow-notebook-lg">
                          <span className="whitespace-nowrap text-lg font-bold text-ink">After Alt Text Pro</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
