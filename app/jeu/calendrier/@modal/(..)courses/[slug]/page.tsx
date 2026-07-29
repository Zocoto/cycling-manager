import {
  RaceProfileContent,
  type RaceProfilePageProps,
} from "@/app/jeu/courses/[slug]/race-profile-content";
import { CourseModal } from "@/components/game/course-modal";

export default function InterceptedRaceProfilePage(
  props: RaceProfilePageProps,
) {
  return (
    <CourseModal>
      <RaceProfileContent {...props} />
    </CourseModal>
  );
}
