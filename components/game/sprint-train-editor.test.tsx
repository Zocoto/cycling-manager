import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SprintTrainEditor } from "./sprint-train-editor";
import type { RacePreparationRider } from "@/services/race-calendar";

const riders = Array.from({ length: 9 }, (_, i) => ({
  riderId: `rider-${i}`, firstName: "Rider", lastName: String(i),
  generalRole: i === 0 ? "sprinter" : "leadout", stageRoles: {}, timeTrialPlans: {},
  ratings: { flat: 70, sprint: 70, acceleration: 70 },
})) as RacePreparationRider[];
const roles = Object.fromEntries(riders.map((rider) => [rider.riderId, rider.generalRole]));
function render(order: string[] = [], disabled = false) {
  return renderToStaticMarkup(<SprintTrainEditor riders={riders} roles={roles} order={order} disabled={disabled} onChange={() => undefined} />);
}
describe("sprint preparation editor", () => {
  it("shows all eight leadouts, never the sprinter as a helper, and defaults to automatic", () => {
    const html = render();
    expect(html.match(/<li\b/g)).toHaveLength(8);
    expect(html).toContain("Sprinteur : Rider 0");
    expect(html).toContain("Ordre automatique · aperçu avant course");
    expect(html).toMatch(/name="sprintTrainOrder" value="\[\]"/);
  });
  it("prunes stale or wrong-role IDs and appends missing teammates before submitting", () => {
    const html = render(["rider-8", "rider-0", "gone", "rider-8"]);
    expect(html).toContain("Ordre personnalisé");
    const input = html.match(/name="sprintTrainOrder" value="([^"]*)"/)![1].replaceAll("&quot;", '"');
    const order = JSON.parse(input);
    expect(order).toHaveLength(8);
    expect(order[0]).toBe("rider-8");
    expect(order).not.toContain("rider-0");
    expect(order).not.toContain("gone");
  });
  it("locks every control after departure", () => {
    const buttons = render(["rider-8"], true).match(/<button\b[^>]*>/g)!;
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => /\sdisabled=/.test(button))).toBe(true);
  });
});
