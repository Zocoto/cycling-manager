import {
  CriteriumDiscoveryRaceContent,
  type CriteriumRacePageProps,
} from "@/app/jeu/courses/criterium-de-la-decouverte/criterium-race-content";
import { CourseModal } from "@/components/game/course-modal";

export default function InterceptedCriteriumDiscoveryPage(
  props: CriteriumRacePageProps,
) {
  return (
    <CourseModal>
      <CriteriumDiscoveryRaceContent {...props} />
    </CourseModal>
  );
}
