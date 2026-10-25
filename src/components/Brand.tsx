import "./Brand.css";

/** The supplied logo is kept intact; the viewport removes its surrounding whitespace. */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-logo ${className}`}>
      <img src="/brand/feelina-logo.jpeg" alt="Feelina — Beautiful inside" />
    </span>
  );
}
