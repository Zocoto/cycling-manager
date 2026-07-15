import Link from "next/link";

type AuthField = {
  id: string;
  label: string;
  type: "email" | "password" | "text";
  placeholder: string;
};

type AuthPreviewProps = {
  eyebrow: string;
  title: string;
  highlightedTitle: string;
  description: string;
  availabilityLabel: string;
  fields: readonly AuthField[];
  submitLabel: string;
  alternateText: string;
  alternateLinkLabel: string;
  alternateHref: string;
  benefits: readonly string[];
};

export function AuthPreview({
  eyebrow,
  title,
  highlightedTitle,
  description,
  availabilityLabel,
  fields,
  submitLabel,
  alternateText,
  alternateLinkLabel,
  alternateHref,
  benefits,
}: AuthPreviewProps) {
  return (
    <section className="relative isolate min-h-[calc(100vh-145px)] overflow-hidden bg-[#102238]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[70%_center] bg-no-repeat opacity-35"
        style={{
          backgroundImage: "url('/images/peloton-header.png')",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(16,34,56,0.99) 0%, rgba(16,34,56,0.94) 48%, rgba(16,34,56,0.73) 100%)",
        }}
      />

      <MountainDecoration />

      <div className="relative mx-auto grid max-w-375 gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_480px] lg:items-center lg:gap-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#69D5AE]">
            {eyebrow}
          </p>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-[#F6F8FA] sm:text-5xl lg:text-6xl">
            {title}
            <span className="block text-[#69D5AE]">
              {highlightedTitle}
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-[#C5D3DD]">
            {description}
          </p>

          <ul className="mt-9 space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#69D5AE]/35 bg-[#69D5AE]/10 text-sm font-bold text-[#69D5AE]"
                >
                  ✓
                </span>

                <span className="leading-7 text-[#E2E9EE]">{benefit}</span>
              </li>
            ))}
          </ul>

          <RoadSeparator />
        </div>

        <article className="relative overflow-hidden rounded-2xl border border-[#86A6BC]/45 bg-[#18324D]/95 shadow-2xl shadow-[#07111F]/35">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#69D5AE]" />

          <WheelDecoration />

          <div className="relative p-6 sm:p-8">
            <div className="rounded-lg border border-[#E5B84B]/40 bg-[#E5B84B]/10 px-4 py-3">
              <p className="text-sm font-semibold text-[#E5B84B]">
                Fonctionnalité en préparation
              </p>

              <p className="mt-1 text-sm leading-6 text-[#D8E2E9]">
                {availabilityLabel}
              </p>
            </div>

            <form className="mt-7 space-y-5">
              {fields.map((field) => (
                <div key={field.id}>
                  <label
                    htmlFor={field.id}
                    className="block text-sm font-semibold text-[#F6F8FA]"
                  >
                    {field.label}
                  </label>

                  <input
                    id={field.id}
                    name={field.id}
                    type={field.type}
                    placeholder={field.placeholder}
                    disabled
                    className="mt-2 min-h-12 w-full cursor-not-allowed rounded-md border border-[#86A6BC]/30 bg-[#102238]/55 px-4 text-[#86A6BC] outline-none placeholder:text-[#86A6BC]/65"
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled
                className="min-h-12 w-full cursor-not-allowed rounded-md border border-[#86A6BC]/30 bg-[#234563]/60 px-5 py-3 font-bold text-[#86A6BC]"
              >
                {submitLabel}
              </button>
            </form>

            <div className="mt-7 border-t border-[#86A6BC]/20 pt-6 text-center">
              <p className="text-sm text-[#C5D3DD]">{alternateText}</p>

              <Link
                href={alternateHref}
                className="mt-2 inline-flex rounded-sm font-semibold text-[#69D5AE] transition hover:text-[#B9E4CE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
              >
                {alternateLinkLabel}
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function RoadSeparator() {
  return (
    <div
      aria-hidden="true"
      className="mt-11 flex max-w-xl items-center gap-2 opacity-80"
    >
      <div className="h-px flex-1 bg-[#86A6BC]/50" />

      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={`road-left-${index}`}
          className="h-px w-7 bg-[#C5D3DD]/55"
        />
      ))}

      <span className="h-0.5 w-14 bg-[#69D5AE]" />

      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={`road-right-${index}`}
          className="h-px w-7 bg-[#C5D3DD]/55"
        />
      ))}

      <div className="h-px flex-1 bg-[#86A6BC]/50" />
    </div>
  );
}

function MountainDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 420"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-80 w-full opacity-[0.12]"
    >
      <path
        d="M0 365 L170 215 L310 330 L490 105 L665 340 L835 180 L1005 350 L1190 135 L1440 315 L1440 420 L0 420 Z"
        fill="#69D5AE"
      />

      <path
        d="M0 390 L220 300 L370 380 L545 235 L720 395 L900 285 L1075 400 L1260 255 L1440 365"
        fill="none"
        stroke="#F6F8FA"
        strokeDasharray="17 15"
        strokeWidth="3"
      />
    </svg>
  );
}

function WheelDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[#86A6BC]/15"
      style={{
        background:
          "repeating-conic-gradient(transparent 0deg 13deg, rgba(134,166,188,0.11) 13deg 14deg)",
      }}
    />
  );
}