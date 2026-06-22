type BesatLogoMarkProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
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
}: BesatLogoMarkProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-visible bg-transparent ${sizeClasses[size]} ${className}`}
    >
      <img
        src="/images/besat-logo-v2.png?v=2"
        alt="نشان مدرسه بعثت"
        className="block h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}
