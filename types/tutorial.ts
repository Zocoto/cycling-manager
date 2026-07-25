export type TutorialType =
  | "onboarding"
  | "contextual"
  | "race_scenario";

export type TutorialProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped";

export type TutorialSessionLaunchSource =
  | "automatic"
  | "manual"
  | "resume"
  | "replay";

export type TutorialSessionStatus =
  | "in_progress"
  | "completed"
  | "abandoned"
  | "skipped";

export type TutorialStepPlacement =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "center";

export type TutorialStepRequirement =
  | "profile_complete"
  | "team_created";

export type TutorialStep = {
  /**
   * Identifiant stable de l’étape.
   *
   * Il est enregistré en base pour permettre de reprendre
   * un parcours interrompu après une déconnexion.
   */
  key: string;

  /**
   * Route sur laquelle l’étape doit être présentée.
   */
  route: string;

  /**
   * Valeur de l’attribut `data-tutorial-id` de l’élément ciblé.
   *
   * Une valeur absente indique une infobulle centrée dans
   * la fenêtre, sans mise en évidence d’un élément précis.
   */
  targetId?: string;

  title: string;
  content: string;

  placement?: TutorialStepPlacement;

  /**
   * Condition métier à remplir avant d’ouvrir cette étape.
   * La vérification est toujours réalisée côté serveur.
   */
  requirement?: TutorialStepRequirement;

  /**
   * Lorsque cette option est active, le joueur peut interagir
   * avec l’élément mis en évidence.
   */
  allowTargetInteraction?: boolean;

  /**
   * Marge en pixels entre la surbrillance et l’élément ciblé.
   */
  highlightPadding?: number;
};

export type TutorialDefinition = {
  /**
   * Identifiant stable du parcours, partagé entre le catalogue
   * TypeScript et la table `tutorial_progress`.
   */
  key: string;

  version: number;
  type: TutorialType;

  title: string;
  description: string;

  /**
   * Seul le parcours général d’onboarding pourra être proposé
   * automatiquement à un nouveau joueur.
   */
  autoStart: boolean;

  /**
   * Tous les parcours pourront être relancés manuellement
   * depuis le Guide.
   */
  replayable: boolean;

  steps: readonly TutorialStep[];
};

export type TutorialProgressRow = {
  id: string;
  sporting_director_id: string;

  tutorial_key: string;
  tutorial_type: TutorialType;
  tutorial_version: number;

  status: TutorialProgressStatus;

  current_step_key: string | null;
  current_route: string | null;

  started_at: string | null;
  completed_at: string | null;
  skipped_at: string | null;

  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
};

export type TutorialSessionRow = {
  id: string;
  tutorial_progress_id: string;

  tutorial_version: number;

  launch_source: TutorialSessionLaunchSource;
  status: TutorialSessionStatus;

  first_step_key: string | null;
  last_step_key: string | null;

  started_at: string;
  ended_at: string | null;

  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
};

export type ActiveTutorial = {
  definition: TutorialDefinition;
  progress: TutorialProgressRow;
  session: TutorialSessionRow;
  currentStepIndex: number;
};

export type StartTutorialOptions = {
  tutorialKey: string;
  launchSource: TutorialSessionLaunchSource;
  restartFromBeginning?: boolean;
};

export type TutorialTargetRectangle = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export type TutorialCatalog = Readonly<
  Record<string, TutorialDefinition>
>;