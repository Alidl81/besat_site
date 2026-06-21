export type AboutContent = {
  title: string | null;
  description: string | null;
};

type AboutContentBlockProps = {
  content: AboutContent | null;
};

export function AboutContentBlock({ content }: AboutContentBlockProps) {
  if (!content?.title && !content?.description) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-emerald-50 text-2xl text-emerald-700">
          ◌
        </div>

        <h2 className="text-xl font-black text-[#0f2f4a]">معرفی مدرسه ثبت نشده است.</h2>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600">
          پس از ثبت معرفی مدرسه، اطلاعات مربوط به این بخش در همین صفحه نمایش داده می‌شود.
        </p>
      </div>
    );
  }

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-8 text-right shadow-sm">
      {content.title ? (
        <h2 className="text-2xl font-black leading-[1.5] text-[#0f2f4a]">{content.title}</h2>
      ) : null}

      {content.description ? (
        <p className="mt-5 whitespace-pre-line text-base leading-9 text-slate-600">
          {content.description}
        </p>
      ) : null}
    </article>
  );
}
