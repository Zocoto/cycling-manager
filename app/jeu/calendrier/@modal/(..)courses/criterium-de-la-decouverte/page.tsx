import CriteriumDiscoveryRacePage from "@/app/jeu/courses/criterium-de-la-decouverte/page";
import { CourseModal } from "@/components/game/course-modal";

type InterceptedCriteriumDiscoveryPageProps = {
  searchParams: Promise<{
    erreur?: string | string[];
  }>;
};

export default async function InterceptedCriteriumDiscoveryPage(
  props: InterceptedCriteriumDiscoveryPageProps,
) {
  return (
    <CourseModal>
      {await CriteriumDiscoveryRacePage(props)}
    </CourseModal>
  );
}
