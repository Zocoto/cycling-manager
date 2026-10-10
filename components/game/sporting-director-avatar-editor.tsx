"use client";

import { useState } from "react";

import {
  AMBULANCIER_AVATAR_OUTFIT_KEY,
  AVATAR_BACKGROUNDS,
  AVATAR_EAR_SHAPES,
  AVATAR_EYEBROW_STYLES,
  AVATAR_EYE_COLORS,
  AVATAR_EYE_SHAPES,
  AVATAR_FACE_SHAPES,
  AVATAR_FACIAL_HAIR_STYLES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_MOUTH_SHAPES,
  AVATAR_NOSE_SHAPES,
  AVATAR_OUTFITS,
  AVATAR_SKIN_TONES,
  EL_PRESIDENTE_AVATAR_OUTFIT_KEY,
  EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY,
  INVETERATE_PLAYER_AVATAR_OUTFIT_KEY,
  PATRON_HAT_AVATAR_OUTFIT_KEY,
  SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY,
  createRandomSportingDirectorAvatar,
  encodeSportingDirectorAvatar,
  getAvailableAvatarCheekStyles,
  getAvailableAvatarGlassesStyles,
  resolveSportingDirectorAvatar,
  type SportingDirectorAvatarConfig,
} from "@/lib/sporting-director-avatar";
import { SportingDirectorAvatar } from "./sporting-director-avatar";
import {
  composeHalloweenAvatarKey, halloweenAvatarArts, HALLOWEEN_AVATAR_COSMETICS,
  toggleHalloweenAvatarItem, type HalloweenAvatarItemId,
} from "@/lib/game/halloween-avatar";
import { HalloweenAvatarChoices, type AvatarStyleCategory } from "./halloween-avatar-choices";

type SportingDirectorAvatarEditorProps = {
  avatarKey: string | null;
  ownedHalloweenItems?: HalloweenAvatarItemId[];
  selectedHalloweenItems?: HalloweenAvatarItemId[];
  frameKey?: "alpha_tester" | null;
  hasAlphaTesterTrophy?: boolean;
  hasAssiduTrophy?: boolean;
  hasHiddenSwitchbackTrophy?: boolean;
  onCancel: () => void;
  onConfirm: (avatarKey: string, frameKey: "alpha_tester" | null, halloweenItems: HalloweenAvatarItemId[]) => void;
  patronOutfitUnlocked?: boolean;
  patronHatUnlocked?: boolean;
  sponsorAmbassadorOutfitUnlocked?: boolean;
  ambulancierOutfitUnlocked?: boolean;
  emergencyDoctorOutfitUnlocked?: boolean;
  inveteratePlayerOutfitUnlocked?: boolean;
  nightAuctionSkinUnlocked?: boolean;
  elPresidenteOutfitUnlocked?: boolean;
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
  ownedHalloweenItems = [],
  selectedHalloweenItems = [],
  frameKey = null,
  hasAlphaTesterTrophy = false,
  hasAssiduTrophy = false,
  hasHiddenSwitchbackTrophy = false,
  onCancel,
  onConfirm,
  patronOutfitUnlocked = false,
  patronHatUnlocked = false,
  sponsorAmbassadorOutfitUnlocked = false,
  ambulancierOutfitUnlocked = false,
  emergencyDoctorOutfitUnlocked = false,
  inveteratePlayerOutfitUnlocked = false,
  nightAuctionSkinUnlocked = false,
  elPresidenteOutfitUnlocked = false,
}: SportingDirectorAvatarEditorProps) {
  const initialConfig = resolveSportingDirectorAvatar(avatarKey);
  const [config, setConfig] =
    useState<SportingDirectorAvatarConfig>(initialConfig);
  const [selectedFrameKey, setSelectedFrameKey] = useState<
    "alpha_tester" | null
  >(hasAlphaTesterTrophy ? frameKey : null);
  const [activeTab, setActiveTab] = useState<EditorTab>("face");
  const [styleCategory, setStyleCategory] = useState<AvatarStyleCategory>("outfit");
  const initialHalloweenItems = selectedHalloweenItems.filter(id => ownedHalloweenItems.includes(id));
  const [halloweenItems, setHalloweenItems] = useState(initialHalloweenItems);
  const curse = halloweenAvatarArts(avatarKey).find(art => art === "vampire" || art === "mummy");
  const previewKey = composeHalloweenAvatarKey(encodeSportingDirectorAvatar(config), halloweenItems, curse);
  const availableGlassesStyles = getAvailableAvatarGlassesStyles({
    hasAssiduTrophy,
    hasHiddenSwitchbackTrophy,
  });
  const availableCheekStyles = getAvailableAvatarCheekStyles({
    hasNightAuctionTrophy: nightAuctionSkinUnlocked,
  });
  const disabledOutfitKeys = [
    patronOutfitUnlocked ? null : "patron",
    patronHatUnlocked ? null : PATRON_HAT_AVATAR_OUTFIT_KEY,
    sponsorAmbassadorOutfitUnlocked
      ? null
      : SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY,
    ambulancierOutfitUnlocked ? null : AMBULANCIER_AVATAR_OUTFIT_KEY,
    emergencyDoctorOutfitUnlocked
      ? null
      : EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY,
    inveteratePlayerOutfitUnlocked
      ? null
      : INVETERATE_PLAYER_AVATAR_OUTFIT_KEY,
    elPresidenteOutfitUnlocked ? null : EL_PRESIDENTE_AVATAR_OUTFIT_KEY,
  ].filter((key): key is string => key !== null);

  function updateField<K extends keyof SportingDirectorAvatarConfig>(
    field: K,
    value: SportingDirectorAvatarConfig[K]
  ) {
    if (field === "background" || field === "outfit") {
      setHalloweenItems(current => current.filter(id => HALLOWEEN_AVATAR_COSMETICS[id].slot !== field));
    }
    setConfig((currentConfig) => ({
      ...currentConfig,
      [field]: value,
    }));
  }

  return (
    <div>
      <div className="grid lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="border-b border-[#315B3E]/10 bg-[linear-gradient(160deg,#E4F2ED,#F8FBF9)] p-5 lg:border-b-0 lg:border-r lg:p-7">
          <div className="lg:sticky lg:top-28">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Aperçu en direct
            </p>

            <div className="mt-4 flex justify-center">
              <SportingDirectorAvatar
                avatarKey={previewKey}
                frameKey={selectedFrameKey}
                size="hero"
                label="Aperçu de votre avatar personnalisé"
                className="ring-8 ring-white/55 shadow-[0_22px_55px_rgba(19,60,46,0.22)]"
              />
            </div>

            <p className="mx-auto mt-5 max-w-64 text-center text-xs leading-5 text-[#60756E]">
              Voici le portrait que les autres managers verront sur votre
              profil, votre équipe et dans le chat.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#176951]">
              {["Profil public", "Équipe", "Chat"].map((surface) => (
                <span
                  key={surface}
                  className="rounded-full border border-[#278B70]/15 bg-white/75 px-2.5 py-1"
                >
                  {surface}
                </span>
              ))}
            </div>

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
                onClick={() => {
                  setConfig(initialConfig);
                  setHalloweenItems(initialHalloweenItems);
                  setSelectedFrameKey(
                    hasAlphaTesterTrophy ? frameKey : null,
                  );
                }}
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
                <AvatarChoiceGroup
                  title="Forme du visage"
                  field="faceShape"
                  value={config.faceShape}
                  options={AVATAR_FACE_SHAPES}
                  onSelect={updateField}
                  previewConfig={config}
                />
                <AvatarChoiceGroup title="Nez" field="noseShape" value={config.noseShape} options={AVATAR_NOSE_SHAPES} onSelect={updateField} />
                <AvatarChoiceGroup title="Oreilles" field="earShape" value={config.earShape} options={AVATAR_EAR_SHAPES} onSelect={updateField} />
                <AvatarChoiceGroup
                  title="Pommettes et détails"
                  description={
                    nightAuctionSkinUnlocked
                      ? "Le trophée Jusqu’au bout de la nuit débloque le skin Cernes."
                      : undefined
                  }
                  field="cheekStyle"
                  value={config.cheekStyle}
                  options={availableCheekStyles}
                  onSelect={updateField}
                />
              </>
            ) : null}

            {activeTab === "eyes" ? (
              <>
                <AvatarChoiceGroup
                  title="Forme des yeux"
                  field="eyeShape"
                  value={config.eyeShape}
                  options={AVATAR_EYE_SHAPES}
                  onSelect={updateField}
                  previewConfig={config}
                />
                <AvatarChoiceGroup title="Couleur des yeux" field="eyeColor" value={config.eyeColor} options={AVATAR_EYE_COLORS} onSelect={updateField} swatches />
                <AvatarChoiceGroup
                  title="Sourcils"
                  field="eyebrowStyle"
                  value={config.eyebrowStyle}
                  options={AVATAR_EYEBROW_STYLES}
                  onSelect={updateField}
                  previewConfig={config}
                />
                <AvatarChoiceGroup
                  title="Expression de la bouche"
                  field="mouthShape"
                  value={config.mouthShape}
                  options={AVATAR_MOUTH_SHAPES}
                  onSelect={updateField}
                  previewConfig={config}
                />
              </>
            ) : null}

            {activeTab === "hair" ? (
              <>
                <AvatarChoiceGroup
                  title="Coiffure"
                  description="Coupes courtes, longues, texturées et attachées peuvent être combinées librement avec les autres traits."
                  field="hairStyle"
                  value={config.hairStyle}
                  options={AVATAR_HAIR_STYLES}
                  onSelect={updateField}
                  previewConfig={config}
                />
                <AvatarChoiceGroup title="Couleur des cheveux" field="hairColor" value={config.hairColor} options={AVATAR_HAIR_COLORS} onSelect={updateField} swatches />
                <AvatarChoiceGroup title="Barbe et moustache" field="facialHair" value={config.facialHair} options={AVATAR_FACIAL_HAIR_STYLES} onSelect={updateField} />
              </>
            ) : null}

            {activeTab === "style" ? (
              <>
                <div className="flex flex-wrap gap-2" aria-label="Catégories de style">
                  {([ ["background", "Fonds"], ["glasses", "Lunettes"], ["hat", "Chapeaux"], ["outfit", "Maillots et tenues"], ["accessories", "Accessoires"] ] as const).map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={styleCategory === key} onClick={() => setStyleCategory(key)}
                      className={avatarFrameChoiceClass(styleCategory === key)}>{label}</button>
                  ))}
                </div>
                {hasAlphaTesterTrophy && styleCategory === "accessories" ? (
                  <fieldset>
                    <legend className="text-sm font-black text-[#183F37]">
                      Liseré du portrait
                    </legend>
                    <p className="mt-1 text-xs leading-5 text-[#60756E]">
                      Votre distinction Alphatesteur peut entourer le portrait
                      sur tous ses affichages publics.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        aria-pressed={selectedFrameKey === null}
                        onClick={() => setSelectedFrameKey(null)}
                        className={avatarFrameChoiceClass(
                          selectedFrameKey === null,
                        )}
                      >
                        <SportingDirectorAvatar
                          avatarKey={previewKey}
                          size="small"
                          label="Avatar sans liseré"
                        />
                        <span>Sans liseré</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={selectedFrameKey === "alpha_tester"}
                        onClick={() => setSelectedFrameKey("alpha_tester")}
                        className={avatarFrameChoiceClass(
                          selectedFrameKey === "alpha_tester",
                        )}
                      >
                        <SportingDirectorAvatar
                          avatarKey={previewKey}
                          frameKey="alpha_tester"
                          size="small"
                          label="Avatar avec liseré Alphatesteur"
                        />
                        <span>Alphatesteur</span>
                      </button>
                    </div>
                  </fieldset>
                ) : null}
                {styleCategory === "glasses" ? <AvatarChoiceGroup
                  title="Lunettes"
                  description={[
                    hasAssiduTrophy
                      ? "Votre trophée Assidu débloque les lunettes Premier de la classe."
                      : null,
                    hasHiddenSwitchbackTrophy
                      ? "Le Virage caché débloque les lunettes d’espion."
                      : null,
                  ].filter(Boolean).join(" ") || undefined}
                  field="glasses"
                  value={config.glasses}
                  options={availableGlassesStyles}
                  onSelect={updateField}
                /> : null}
                {styleCategory === "outfit" ? <AvatarChoiceGroup
                  title="Maillots et tenues"
                  description={[
                    patronOutfitUnlocked
                      ? "La tenue du Parrain est débloquée grâce à vos filleuls."
                      : "La tenue du Parrain se débloque avec 5 filleuls qualifiés.",
                    patronHatUnlocked
                      ? "Le costume et le fedora du Don sont débloqués grâce à vos 25 filleuls."
                      : "Le fedora du Don se débloque avec 25 filleuls qualifiés.",
                    sponsorAmbassadorOutfitUnlocked
                      ? "Le Maillot d’Or des Ambassadeurs récompense votre saison à 100 % de satisfaction sponsor."
                      : "Le Maillot d’Or des Ambassadeurs se débloque avec le trophée Ambassadeur exemplaire.",
                    ambulancierOutfitUnlocked
                      ? "Le chapeau d’infirmière est débloqué avec le trophée Ambulancier."
                      : "Le chapeau d’infirmière demande 5 blessés simultanés.",
                    emergencyDoctorOutfitUnlocked
                      ? "La blouse et le stéthoscope sont débloqués avec le trophée Médecin urgentiste."
                      : "La tenue de docteur urgentiste demande 10 blessés simultanés.",
                    inveteratePlayerOutfitUnlocked
                      ? "Les piles de jetons récompensent vos dix jours parfaits dans les jeux de La Cyclogazette."
                      : "Les piles de jetons sont liées à un trophée caché de La Cyclogazette.",
                    elPresidenteOutfitUnlocked
                      ? "La tenue El Presidente récompense votre prise de fonction à la tête d’une fédération."
                      : "La tenue El Presidente se débloque en devenant président d’une fédération.",
                  ].join(" ")}
                  field="outfit"
                  value={config.outfit}
                  options={AVATAR_OUTFITS}
                  onSelect={updateField}
                  disabledKeys={disabledOutfitKeys}
                  swatches
                /> : null}
                {styleCategory === "background" ? <AvatarChoiceGroup title="Fond du portrait" field="background" value={config.background} options={AVATAR_BACKGROUNDS} onSelect={updateField} swatches /> : null}
                {styleCategory !== "glasses" ? <HalloweenAvatarChoices category={styleCategory} owned={ownedHalloweenItems}
                  selected={halloweenItems} baseKey={encodeSportingDirectorAvatar(config)} curse={curse}
                  onToggle={id => setHalloweenItems(current => toggleHalloweenAvatarItem(current, id))} /> : null}
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
          onClick={() => onConfirm(previewKey, selectedFrameKey, halloweenItems)}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#176951] px-5 py-2 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#0E5141] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2"
        >
          Valider ce portrait
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
  disabledKeys?: readonly string[];
  previewConfig?: SportingDirectorAvatarConfig;
};

function AvatarChoiceGroup<K extends keyof SportingDirectorAvatarConfig>({
  title,
  description,
  field,
  value,
  options,
  onSelect,
  swatches = false,
  disabledKeys = [],
  previewConfig,
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
          const isDisabled = disabledKeys.includes(option.key);
          const optionPreviewKey = previewConfig
            ? encodeSportingDirectorAvatar(
                {
                  ...previewConfig,
                  [field]: option.key,
                } as SportingDirectorAvatarConfig,
              )
            : null;

          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={isSelected}
              disabled={isDisabled}
              onClick={() =>
                onSelect(
                  field,
                  option.key as SportingDirectorAvatarConfig[K]
                )
              }
              className={[
                "relative flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-1",
                isDisabled ? "cursor-not-allowed border-[#315B3E]/10 bg-[#F2F5F3] text-[#8A9B95] opacity-70" : "",
                isSelected
                  ? "border-[#278B70] bg-[#DFF4EC] text-[#0E5141] shadow-sm"
                  : "border-[#315B3E]/15 bg-white text-[#48665F] hover:border-[#42B99A] hover:bg-[#F3FAF7]",
              ].join(" ")}
            >
              {optionPreviewKey ? (
                <SportingDirectorAvatar
                  avatarKey={optionPreviewKey}
                  size="small"
                  label={`Aperçu : ${option.label}`}
                  className="ring-1 ring-[#315B3E]/10"
                />
              ) : swatches && swatchColor ? (
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
              {isDisabled ? (
                <span aria-hidden="true" className="ml-auto text-sm">🔒</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function avatarFrameChoiceClass(isSelected: boolean) {
  return [
    "flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2 text-left text-xs font-bold transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-1",
    isSelected
      ? "border-[#278B70] bg-[#DFF4EC] text-[#0E5141] shadow-sm"
      : "border-[#315B3E]/15 bg-white text-[#48665F] hover:border-[#42B99A] hover:bg-[#F3FAF7]",
  ].join(" ");
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
