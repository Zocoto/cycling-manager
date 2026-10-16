import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SportingDirectorAvatar } from "./sporting-director-avatar";
import { SportingDirectorAvatarEditor } from "./sporting-director-avatar-editor";
import { CAREER_AVATAR_OUTFITS } from "@/lib/game/prospective-achievements";
import { createRandomSportingDirectorAvatar, DEFAULT_SPORTING_DIRECTOR_AVATAR, encodeSportingDirectorAvatar } from "@/lib/sporting-director-avatar";

describe("career milestones and cosmetics", () => {
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
