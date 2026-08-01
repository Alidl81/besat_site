type BesatLogoMarkProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
  tone?: "brand" | "light";
};

const sizeClasses = {
  sm: "h-18 w-18",
  md: "h-20 w-20",
  lg: "h-22 w-22",
  xl: "h-25 w-25",
};

export function BesatLogoMark({
  size = "lg",
  className = "",
  tone = "brand",
}: BesatLogoMarkProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-visible bg-transparent ${sizeClasses[size]} ${className}`}
    >
      <img
        src="/images/official/brand/besat-logo.svg"
        alt="نشان رسمی مجتمع آموزشی بعثت"
        className={`block h-full w-full object-contain ${tone === "light" ? "brightness-0 invert" : ""}`}
        draggable={false}
      />
    </span>
  );
}
