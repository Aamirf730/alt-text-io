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
            className="font-outfit text-4xl font-bold tracking-[-0.055em] text-black sm:text-5xl lg:text-[4.2rem] lg:leading-[1.04]"
          >
            Better alt text, automatically.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-500 sm:text-xl">
            From empty alt text to meaningful descriptions in seconds.
          </p>
        </div>

        <div className="relative mt-14 overflow-hidden rounded-[2rem] border border-[#d4dadd] bg-white shadow-[0_22px_70px_rgba(15,23,42,0.12)] sm:mt-16 lg:mt-20 lg:rounded-[2.1rem]">
          <div className="flex min-h-[680px] flex-col lg:flex-row">
            <aside className="flex w-full shrink-0 flex-col bg-[#1f2b32] px-5 py-6 text-white sm:px-7 lg:w-[230px] lg:px-0 lg:py-8 lg:rounded-l-[2.1rem]">
              <div className="flex items-center px-1 lg:px-6">
                <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/45 bg-[#1f2b32]">
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
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors lg:rounded-none lg:px-6 ${
                      active ? "bg-[#2b93c9] text-white" : "text-slate-200/90"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </div>
                ))}
              </nav>

              <span className="mt-auto hidden px-6 pt-12 text-xs text-slate-300/80 lg:block">Collapse menu</span>
            </aside>

            <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-11 lg:py-10">
              <div className="flex flex-col gap-7 border-b border-slate-200 pb-7 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
                <div className="flex flex-wrap items-center gap-5">
                  <h3 className="font-outfit text-3xl font-medium tracking-[-0.04em] text-black sm:text-4xl">Media Library</h3>
                  <button type="button" className="inline-flex h-12 items-center gap-2 rounded-md border border-[#a9bac8] px-4 text-base font-medium text-[#245b87] transition hover:border-[#245b87] hover:bg-[#f4f8fb]">
                    <Plus className="h-5 w-5" aria-hidden="true" />
                    Add New
                  </button>
                </div>
                <div className="flex w-full max-w-[420px] items-center justify-end gap-3 text-sm text-slate-500">
                  <span className="shrink-0 whitespace-nowrap">Search media</span>
                  <div className="flex h-12 w-full min-w-0 max-w-[300px] flex-1 items-center rounded-md border border-[#a9bac8] bg-white px-3">
                    <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span className="sr-only">Search media</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 py-7">
                <button type="button" aria-label="Grid view" className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-[#a9bac8] text-[#245b87]">
                  <LayoutGrid className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" aria-label="List view" className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-[#a9bac8] text-[#245b87]">
                  <LayoutList className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" className="inline-flex h-12 items-center gap-3 rounded-md border border-[#a9bac8] px-4 text-base text-[#245b87]">
                  All media items
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className="inline-flex h-12 items-center gap-3 rounded-md border border-[#a9bac8] px-4 text-base text-[#245b87]">
                  All dates
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="overflow-x-auto rounded-sm border border-slate-200">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[2.2fr_0.8fr_1fr_1fr_1.5fr] items-center border-b border-slate-200 bg-[#fbfcfd] px-5 py-5 text-sm font-semibold text-slate-700">
                    <span>File</span>
                    <span>Author</span>
                    <span>Uploaded to</span>
                    <span>Date</span>
                    <span>Alt Text</span>
                  </div>

                  {mediaRows.map((row, index) => (
                    <div key={row.altState} className="relative grid min-h-[190px] grid-cols-[2.2fr_0.8fr_1fr_1fr_1.5fr] items-center border-b border-slate-200 px-5 py-7 last:border-b-0">
                      <div className="flex items-center gap-4">
                        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-md bg-slate-100">
                          <Image src="/mountain-landscape.jpg" alt={row.imageAlt} fill sizes="112px" className="object-cover" />
                        </div>
                        <div>
                          <p className="text-base font-medium text-[#2a4057]">mountain-lake.jpg</p>
                          <p className="mt-1 text-sm text-slate-500">JPG</p>
                        </div>
                      </div>
                      <span className="text-base text-[#40556d]">You</span>
                      <span className="text-base text-[#1767ad]">Blog Post</span>
                      <span className="text-base text-[#40556d]">May 20, 2026</span>
                      {row.altState === "generated" ? (
                        <div className="max-w-[330px] rounded-xl border border-[#f1d211] bg-[#fffef0] px-4 py-4 text-sm text-[#25384c]">
                          <div className="font-semibold text-black">Generated alt text</div>
                          <p className="mt-3 leading-6">Turquoise alpine lake reflecting sunlit mountain peaks and pine trees under a clear sky.</p>
                          <p className="mt-3 text-sm font-medium text-black">Ready to use</p>
                        </div>
                      ) : (
                        <span className="w-fit rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">No alt text</span>
                      )}

                      {index === 0 && (
                        <div className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d7dfe2] bg-white px-7 py-4 shadow-[0_16px_34px_rgba(15,23,42,0.1)]">
                          <span className="whitespace-nowrap text-lg font-bold text-black">After Alt Text Pro</span>
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
