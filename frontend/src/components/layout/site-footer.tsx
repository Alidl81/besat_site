import { Container } from "@/components/shared/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="py-8">
        <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <p className="font-semibold text-slate-900">مدرسه بعثت</p>
          <p>تمامی حقوق متعلق به مدرسه بعثت است.</p>
        </div>
      </Container>
    </footer>
  );
}
