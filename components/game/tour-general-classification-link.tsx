import Link from "@/components/ui/app-link";

export function TourGeneralClassificationLink({
  editionSlug,
  stageNumber,
}: {
  editionSlug: string;
  stageNumber: number;
}) {
  return (
    <Link
      href={`/jeu/resultats/${editionSlug}/${stageNumber}?classement=general`}
      prefetch={false}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#F2C94C] px-5 text-xs font-black uppercase tracking-[0.1em] text-[#173E35] shadow-[0_12px_30px_rgba(242,201,76,0.22)] transition hover:-translate-y-0.5 hover:bg-[#F7D967] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      Classement général
      <span aria-hidden="true">→</span>
    </Link>
  );
}