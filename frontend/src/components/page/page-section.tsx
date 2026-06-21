import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import type { ReactNode } from "react";

type PageSectionProps = {
  children: ReactNode;
  className?: string;
};

export function PageSection({ children, className = "" }: PageSectionProps) {
  return (
    <section className={`py-14 md:py-16 ${className}`}>
      <Container>
        <Reveal mode="lazy" reserveClassName="min-h-56">
          {children}
        </Reveal>
      </Container>
    </section>
  );
}
