import RaceProfilePage from "@/app/jeu/courses/[slug]/page";
import { CourseModal } from "@/components/game/course-modal";

type InterceptedRaceProfilePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    inscription?: string | string[];
    erreur?: string | string[];
  }>;
};

export default async function InterceptedRaceProfilePage(
  props: InterceptedRaceProfilePageProps
) {
  return (
    <CourseModal>
      {await RaceProfilePage(props)}
    </CourseModal>
  );
}
