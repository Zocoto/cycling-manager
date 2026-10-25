import { Children, isValidElement, type ComponentProps, type MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TrainingIntensityPresets } from "./training-intensity-presets";

function buttons(intensity: number, onChange = vi.fn()) {
  const element = TrainingIntensityPresets({ intensity, onChange });
  return Children.toArray(element.props.children).map((child) => {
    if (!isValidElement<ComponentProps<"button">>(child)) throw Error("Expected a preset button");
    return child;
  });
}

describe("training intensity shortcuts", () => {
  it("offers exactly the five standard percentages without any submit button", () => {
    const shortcuts = buttons(50);
    expect(shortcuts).toHaveLength(5);
    expect(shortcuts.map(button => button.props["aria-label"])).toEqual([
      "Régler l’intensité à 0 %", "Régler l’intensité à 25 %", "Régler l’intensité à 50 %",
      "Régler l’intensité à 75 %", "Régler l’intensité à 100 %",
    ]);
    for (const button of shortcuts) {
      expect(button.props.type).toBe("button");
      expect(button.props.name).toBeUndefined();
      expect(button.props.formAction).toBeUndefined();
    }
  });
  it.each([0, 25, 50, 75, 100])("chooses %i locally through the existing change callback", value => {
    const onChange = vi.fn();
    const button = buttons(58, onChange).find(button => button.props["aria-label"] === `Régler l’intensité à ${value} %`)!;
    expect(onChange).not.toHaveBeenCalled();
    button.props.onClick?.({} as MouseEvent<HTMLButtonElement>);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(value);
  });
  it.each([0, 25, 50, 75, 100])("marks only the exact current preset %i as active", value => {
    const shortcuts = buttons(value);
    expect(shortcuts.filter(button => button.props["aria-pressed"])).toHaveLength(1);
    expect(shortcuts.find(button => button.props["aria-pressed"])?.props["aria-label"])
      .toBe(`Régler l’intensité à ${value} %`);
  });
  it("does not round a custom percentage or call the change callback while rendering", () => {
    const onChange = vi.fn();
    expect(buttons(58, onChange).every(button => button.props["aria-pressed"] === false)).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("keeps visible focus, touch targets and an accessible group label", () => {
    const markup = renderToStaticMarkup(<TrainingIntensityPresets intensity={50} onChange={vi.fn()} />);
    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Paliers d’intensité"');
    expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain("min-h-9");
  });
});
