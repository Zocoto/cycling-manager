import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const panel = readFileSync(
  join(process.cwd(), "components/game/direct-messaging-panel.tsx"),
  "utf8",
);

describe("direct messaging mobile layout", () => {
  it("cantonne la grille et le fil privé à la largeur du téléphone", () => {
    expect(panel).toContain(
      "min-w-0 max-w-full grid-cols-[minmax(0,1fr)] overflow-hidden",
    );
    expect(panel).toContain(
      "w-full min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto",
    );
    expect(panel).toContain('className={`flex min-w-0 ${');
  });

  it("fait tenir les bulles et les textes longs sans rognage", () => {
    expect(panel).toContain(
      "min-w-0 max-w-[92%] overflow-hidden rounded-2xl",
    );
    expect(panel).toContain("sm:max-w-[min(40rem,85%)]");
    expect(panel).toContain("[overflow-wrap:anywhere]");
  });

  it("évite le zoom iOS des champs et laisse l’aide revenir à la ligne", () => {
    expect(panel.match(/text-base[^\n]+sm:text-sm/g)).toHaveLength(2);
    expect(panel).toContain("min-w-0 flex-wrap items-center gap-x-3 gap-y-1");
    expect(panel).toContain(
      'className="basis-full text-[9px] font-semibold leading-4',
    );
  });
});
