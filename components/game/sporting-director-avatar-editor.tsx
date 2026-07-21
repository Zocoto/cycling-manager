"use client";

import { useState } from "react";

import {
  AVATAR_BACKGROUNDS,
  AVATAR_CHEEK_STYLES,
  AVATAR_EAR_SHAPES,
  AVATAR_EYEBROW_STYLES,
  AVATAR_EYE_COLORS,
  AVATAR_EYE_SHAPES,
  AVATAR_FACE_SHAPES,
  AVATAR_FACIAL_HAIR_STYLES,
  AVATAR_GLASSES_STYLES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_MOUTH_SHAPES,
  AVATAR_NOSE_SHAPES,
  AVATAR_OUTFITS,
  AVATAR_SKIN_TONES,
  createRandomSportingDirectorAvatar,
  encodeSportingDirectorAvatar,
  resolveSportingDirectorAvatar,
  type SportingDirectorAvatarConfig,
} from "@/lib/sporting-director-avatar";
import { SportingDirectorAvatar } from "./sporting-director-avatar";

type SportingDirectorAvatarEditorProps = {
  avatarKey: string | null;
  onCancel: () => void;
  onConfirm: (avatarKey: string) => void;
};

type EditorTab = "face" | "eyes" | "hair" | "style";

const editorTabs: Array<{
  key: EditorTab;
  label: string;
  shortLabel: string;
}> = [
  { key: "face", label: "Visage", shortLabel: "Visage" },
  { key: "eyes", label: "Regard", shortLabel: "Regard" },
  { key: "hair", label: "Cheveux et barbe", shortLabel: "Cheveux" },
  { key: "style", label: "Style", shortLabel: "Style" },
];

export function SportingDirectorAvatarEditor({
  avatarKey,
  onCancel,
  onConfirm,
}: SportingDirectorAvatarEditorProps) {
  const initialConfig = resolveSportingDirectorAvatar(avatarKey);
  const [config, setConfig] =
    useState<SportingDirectorAvatarConfig>(initialConfig);
  const [activeTab, setActiveTab] = useState<EditorTab>("face");
  const previewKey = encodeSportingDirectorAvatar(config);

  function updateField<K extends keyof SportingDirectorAvatarConfig>(
    field: K,
    value: SportingDirectorAvatarConfig[K]
  ) {
    setConfig((currentConfig) => ({
      ...currentConfig,
      [field]: value,
    }));
  }

  return (
    <div>
      <div className="grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-[#315B3E]/10 bg-[linear-gradient(160deg,#E4F2ED,#F8FBF9)] p-5 lg:border-b-0 lg:border-r lg:p-7">
          <div className="lg:sticky lg:top-28">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Aperçu en direct
            </p>

            <div className="mt-4 flex justify-center">
              <SportingDirectorAvatar
                avatarKey={previewKey}
                size="xlarge"
                label="Aperçu de votre avatar personnalisé"
                className="ring-8 ring-white/55 shadow-[0_22px_55px_rgba(19,60,46,0.22)]"
              />
            </div>

            <p className="mx-auto mt-5 max-w-52 text-center text-xs leading-5 text-[#60756E]">
              Chaque détail peut être repris plus tard depuis votre profil de Directeur Sportif.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setConfig(createRandomSportingDirectorAvatar())
                }
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#278B70]/25 bg-white px-3 py-2 text-xs font-extrabold text-[#176951] transition hover:border-[#278B70] hover:bg-[#DFF4EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
              >
                <ShuffleIcon />
                Aléatoire
              </button>

              <button
                type="button"
                onClick={() => setConfig(initialConfig)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#315B3E]/15 bg-white px-3 py-2 text-xs font-extrabold text-[#48665F] transition hover:border-[#278B70] hover:text-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 p-5 sm:p-7">
          <div
            role="tablist"
            aria-label="Catégories de personnalisation"
            className="grid grid-cols-4 gap-1 rounded-xl bg-[#E4EFEB] p-1"
          >
            {editorTabs.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  id={`avatar-tab-${tab.key}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`avatar-panel-${tab.key}`}
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    "min-h-10 rounded-lg px-2 py-2 text-xs font-extrabold transition sm:text-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]",
                    isActive
                      ? "bg-white text-[#176951] shadow-sm"
                      : "text-[#60756E] hover:bg-white/55 hover:text-[#183F37]",
                  ].join(" ")}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <div
            id={`avatar-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`avatar-tab-${activeTab}`}
            className="mt-7 space-y-7"
          >
            {activeTab === "face" ? (
              <>
                <AvatarChoiceGroup
                  title="Carnation"
                  description="Choisissez la teinte de peau de votre Directeur Sportif."
                  field="skinTone"
                  value={config.skinTone}
                  options={AVATAR_SKIN_TONES}
                  onSelect={updateField}
                  swatches
                />
                <AvatarChoiceGroup title="Forme du visage" field="faceShape" value={config.faceShape} options={AVATAR_FACE_SHAPES} onSelect={updateField} />
                <AvatarChoiceGroup title="Nez" field="noseShape" value={config.noseShape} options={AVATAR_NOSE_SHAPES} onSelect={updateField} />
                <AvatarChoiceGroup title="Oreilles" field="earShape" value={config.earShape} options={AVATAR_EAR_SHAPES} onSelect={updateField} />
                <AvatarChoiceGroup title="Pommettes et détails" field="cheekStyle" value={config.cheekStyle} options={AVATAR_CHEEK_STYLES} onSelect={updateField} />
              </>
            ) : null}

            {activeTab === "eyes" ? (
              <>
                <AvatarChoiceGroup title="Forme des yeux" field="eyeShape" value={config.eyeShape} options={AVATAR_EYE_SHAPES} onSelect={updateField} />
                <AvatarChoiceGroup title="Couleur des yeux" field="eyeColor" value={config.eyeColor} options={AVATAR_EYE_COLORS} onSelect={updateField} swatches />
                <AvatarChoiceGroup title="Sourcils" field="eyebrowStyle" value={config.eyebrowStyle} options={AVATAR_EYEBROW_STYLES} onSelect={updateField} />
                <AvatarChoiceGroup title="Expression de la bouche" field="mouthShape" value={config.mouthShape} options={AVATAR_MOUTH_SHAPES} onSelect={updateField} />
              </>
            ) : null}

            {activeTab === "hair" ? (
              <>
                <AvatarChoiceGroup title="Coiffure" field="hairStyle" value={config.hairStyle} options={AVATAR_HAIR_STYLES} onSelect={updateField} />
                <AvatarChoiceGroup title="Couleur des cheveux" field="hairColor" value={config.hairColor} options={AVATAR_HAIR_COLORS} onSelect={updateField} swatches />
                <AvatarChoiceGroup title="Barbe et moustache" field="facialHair" value={config.facialHair} options={AVATAR_FACIAL_HAIR_STYLES} onSelect={updateField} />
              </>
            ) : null}

            {activeTab === "style" ? (
              <>
                <AvatarChoiceGroup title="Lunettes" field="glasses" value={config.glasses} options={AVATAR_GLASSES_STYLES} onSelect={updateField} />
                <AvatarChoiceGroup title="Tenue" field="outfit" value={config.outfit} options={AVATAR_OUTFITS} onSelect={updateField} swatches />
                <AvatarChoiceGroup title="Fond du portrait" field="background" value={config.background} options={AVATAR_BACKGROUNDS} onSelect={updateField} swatches />
              </>
            ) : null}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-[#315B3E]/10 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-7">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#315B3E]/20 bg-white px-5 py-2 text-sm font-bold text-[#48665F] transition hover:border-[#278B70] hover:bg-[#DFF4EC] hover:text-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={() => onConfirm(previewKey)}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#176951] px-5 py-2 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#0E5141] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2"
        >
          Appliquer cet avatar
        </button>
      </div>
    </div>
  );
}

type ChoiceOption = {
  key: string;
  label: string;
  color?: string;
  jacket?: string;
};

type AvatarChoiceGroupProps<K extends keyof SportingDirectorAvatarConfig> = {
  title: string;
  description?: string;
  field: K;
  value: SportingDirectorAvatarConfig[K];
  options: readonly ChoiceOption[];
  onSelect: <Field extends keyof SportingDirectorAvatarConfig>(
    field: Field,
    value: SportingDirectorAvatarConfig[Field]
  ) => void;
  swatches?: boolean;
};

function AvatarChoiceGroup<K extends keyof SportingDirectorAvatarConfig>({
  title,
  description,
  field,
  value,
  options,
  onSelect,
  swatches = false,
}: AvatarChoiceGroupProps<K>) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-[#183F37]">{title}</legend>
      {description ? (
        <p className="mt-1 text-xs leading-5 text-[#60756E]">{description}</p>
      ) : null}

      <div className={[
        "mt-3 grid gap-2",
        swatches ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3",
      ].join(" ")}>
        {options.map((option) => {
          const isSelected = option.key === value;
          const swatchColor = option.color ?? option.jacket;

          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={isSelected}
              onClick={() =>
                onSelect(
                  field,
                  option.key as SportingDirectorAvatarConfig[K]
                )
              }
              className={[
                "relative flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-1",
                isSelected
                  ? "border-[#278B70] bg-[#DFF4EC] text-[#0E5141] shadow-sm"
                  : "border-[#315B3E]/15 bg-white text-[#48665F] hover:border-[#42B99A] hover:bg-[#F3FAF7]",
              ].join(" ")}
            >
              {swatches && swatchColor ? (
                <span
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(49,91,62,0.22)]"
                  style={{ backgroundColor: swatchColor }}
                />
              ) : null}
              <span className="min-w-0 leading-4">{option.label}</span>
              {isSelected ? (
                <span aria-hidden="true" className="ml-auto text-sm font-black text-[#278B70]">✓</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ShuffleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h2.5c4.5 0 4.5 10 9 10H17" />
      <path d="m14 12 3 3-3 3" />
      <path d="M3 15h2.5C7 15 8 13.8 9 12.3" />
      <path d="M11 7.7C12 6.2 13 5 14.5 5H17" />
      <path d="m14 2 3 3-3 3" />
    </svg>
  );
}
