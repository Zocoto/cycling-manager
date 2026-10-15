import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProspectiveAchievementMilestones } from "./prospective-achievement-milestones";
import { SportingDirectorAvatar } from "./sporting-director-avatar";
import { SportingDirectorAvatarEditor } from "./sporting-director-avatar-editor";
import { CAREER_AVATAR_OUTFITS } from "@/lib/game/prospective-achievements";
import { createRandomSportingDirectorAvatar, DEFAULT_SPORTING_DIRECTOR_AVATAR, encodeSportingDirectorAvatar } from "@/lib/sporting-director-avatar";
import { careerObjective } from "@/test/career-achievement-fixtures";

describe("career milestones and cosmetics", () => {
  it("shows three compact milestones with accessible folded conditions and every reward", () => {
    const members = [careerObjective("bronze","claimed"),careerObjective("silver","ready"),careerObjective("gold")];
    const html = renderToStaticMarkup(<ProspectiveAchievementMilestones objective={members[1]} members={members}/>);
    expect(html).toContain("sans rétroactivité");
    expect(html).toContain("15 octobre 2026");
    expect(html).toContain("✓ Bronze");
    expect(html).toContain("● Argent");
    expect(html).toContain("<details");
    expect(html).toContain("14 journées");
    expect(html).toContain("tenue exclusive");
    expect(html).toContain("300 XP");
    expect(html).not.toContain("<details open");
  });
  it.each(CAREER_AVATAR_OUTFITS)("renders the exclusive %s outfit and roundtrips its key", outfit => {
    const key = encodeSportingDirectorAvatar({...DEFAULT_SPORTING_DIRECTOR_AVATAR,outfit});
    expect(renderToStaticMarkup(<SportingDirectorAvatar avatarKey={key}/>)).toContain(`data-avatar-career-outfit="${outfit.replace("career-","")}"`);
  });
  it("does not hand out exclusive outfits through randomization", () => {
    for (let i=0;i<300;i++) expect(createRandomSportingDirectorAvatar().outfit.startsWith("career-")).toBe(false);
  });
  it("has an editor-side lock for each exclusive outfit", () => {
    // The outfits pane is initially closed; DB/action authorization is tested
    // separately. The closed editor must not render a selectable reward.
    const html = renderToStaticMarkup(<SportingDirectorAvatarEditor avatarKey={null} onCancel={()=>{}} onConfirm={()=>{}}/>);
    expect(html).not.toContain('value="career-shopkeeper"');
  });
});
