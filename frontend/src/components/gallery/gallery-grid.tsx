export type GalleryItem = {
  id: string;
  title: string;
  imageUrl: string;
  alt: string;
};

type GalleryGridProps = {
  items: GalleryItem[];
};

export function GalleryGrid({ items }: GalleryGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-2xl text-emerald-700">
          ◌
        </div>

        <h2 className="text-xl font-black text-[#0f2f4a]">تصویری برای نمایش ثبت نشده است.</h2>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600">
          گالری تصاویر مدرسه پس از ثبت محتوا در همین صفحه نمایش داده می‌شود.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition duration-500 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-slate-200/70"
        >
          <div className="aspect-[4/3] overflow-hidden bg-slate-100">
            <img
              src={item.imageUrl}
              alt={item.alt}
              className="size-full object-cover transition duration-700 group-hover:scale-105"
            />
          </div>

          <div className="p-5 text-right">
            <h2 className="text-base font-black text-[#0f2f4a]">{item.title}</h2>
          </div>
        </article>
      ))}
    </div>
  );
}
