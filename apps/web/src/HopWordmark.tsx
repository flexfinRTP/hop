export function HopWordmark({
  className,
  tone = "moss",
}: {
  className?: string;
  tone?: "moss" | "cream";
}) {
  const src =
    tone === "cream"
      ? "/brand/hop-wordmark-cream-lockup.png"
      : "/brand/hop-wordmark-moss-lockup.png";
  return <img className={className ?? "hop-wordmark"} src={src} alt="HOP" />;
}
