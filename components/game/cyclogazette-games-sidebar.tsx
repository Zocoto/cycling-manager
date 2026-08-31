"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  initialCyclogazetteGameActionState,
  initialCyclogazettePollActionState,
  validateCyclogazetteGameAction,
  voteCyclogazettePollAction,
} from "@/app/jeu/gazette/actions";
import { useLocale } from "@/components/i18n/locale-provider";
import type {
  CyclogazetteCrosswordPuzzle,
  CyclogazetteGameDifficulty,
  CyclogazetteSudokuPuzzle,
} from "@/lib/game/cyclogazette-games";
import type { CyclogazetteGamesOverview } from "@/services/cyclogazette-games";

type GameTab = "sudoku" | "crossword";

export function CyclogazetteGamesSidebar({
  overview,
}: {
  overview: CyclogazetteGamesOverview;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [activeGame, setActiveGame] = useState<GameTab>("sudoku");
  const sudokuCompleted = overview.viewerCompletedGames.includes("sudoku");
  const crosswordCompleted =
    overview.viewerCompletedGames.includes("crossword");

  return (
    <div
      data-cyclogazette-section="games"
      className="min-w-0 bg-[#F2E6C8] text-[#2E281D]"
    >
      <header className="border-b border-[#7D6C49]/45 px-4 py-4 sm:px-6">
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#9B263D]">
          {isEnglish ? "Inside the Gazette" : "Dans la Gazette"}
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h2 className="font-serif text-3xl font-black tracking-[-0.04em]">
            {isEnglish ? "Games & readers" : "Jeux & lecteurs"}
          </h2>
          <span className="pb-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#6E624B]">
            N° {overview.issueNumber}
          </span>
        </div>
        <p className="mt-2 font-serif text-xs italic leading-5 text-[#655A43]">
          {isEnglish
            ? `Two daily challenges. Each first success earns €${formatCash(overview.rewardCash)}.`
            : `Deux défis quotidiens. Chaque première réussite rapporte ${formatCash(overview.rewardCash)} €.`}
        </p>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.85fr)]">
        <div className="min-w-0 lg:border-r lg:border-[#7D6C49]/45">
          <div className="grid grid-cols-2 border-b border-[#7D6C49]/40 bg-[#E5D5AF] p-1">
            <GameTabButton
              active={activeGame === "sudoku"}
              completed={sudokuCompleted}
              onClick={() => setActiveGame("sudoku")}
            >
              Sudoku
            </GameTabButton>
            <GameTabButton
              active={activeGame === "crossword"}
              completed={crosswordCompleted}
              onClick={() => setActiveGame("crossword")}
            >
              {isEnglish ? "Crossword" : "Mots croisés"}
            </GameTabButton>
          </div>

          <div className="p-4 sm:p-6">
            <div className={activeGame === "sudoku" ? "block" : "hidden"}>
              <SudokuGame
                editionId={overview.editionId}
                puzzle={overview.games.sudoku}
                playable={overview.isPlayable}
                initiallyCompleted={sudokuCompleted}
              />
            </div>
            <div className={activeGame === "crossword" ? "block" : "hidden"}>
              <CrosswordGame
                editionId={overview.editionId}
                puzzle={overview.games.crossword}
                playable={overview.isPlayable}
                initiallyCompleted={crosswordCompleted}
              />
            </div>
          </div>
        </div>

        <div className="min-w-0 border-t border-[#7D6C49]/45 lg:border-t-0">
          {overview.poll ? (
            <DailyPoll
              poll={overview.poll}
              playable={overview.isPlayable}
              isEnglish={isEnglish}
            />
          ) : null}
          <DailyCompleters
            completers={overview.completers}
            total={overview.totalCompleters}
            isEnglish={isEnglish}
          />
          <YesterdaySolutions
            solutions={overview.previousSolutions}
            isEnglish={isEnglish}
          />
        </div>
      </div>
    </div>
  );
}

function GameTabButton({
  active,
  completed,
  onClick,
  children,
}: {
  active: boolean;
  completed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 border px-2 py-2 text-[10px] font-black uppercase tracking-[0.09em] transition ${
        active
          ? "border-[#2E281D] bg-[#2E281D] text-[#FFF6DE]"
          : "border-transparent text-[#655A43] hover:bg-white/45"
      }`}
    >
      {children}
      {completed ? <span className="ml-1 text-[#D7A928]">✓</span> : null}
    </button>
  );
}

function SudokuGame({
  editionId,
  puzzle,
  playable,
  initiallyCompleted,
}: {
  editionId: string;
  puzzle: CyclogazetteSudokuPuzzle;
  playable: boolean;
  initiallyCompleted: boolean;
}) {
  const [values, setValues] = useState(() =>
    puzzle.cells.map((value) => (value ? String(value) : "")),
  );
  const [state, formAction, pending] = useActionState(
    validateCyclogazetteGameAction,
    initialCyclogazetteGameActionState,
  );
  const completed = initiallyCompleted || state.result === "success";
  useRefreshAfterSuccess(state.result);

  return (
    <GameForm
      editionId={editionId}
      gameType="sudoku"
      answer={values.join("")}
      difficulty={puzzle.difficulty}
      playable={playable}
      completed={completed}
      result={state.result}
      pending={pending}
      formAction={formAction}
    >
      <div
        className="mx-auto grid aspect-square w-full max-w-[292px] grid-cols-9 border-2 border-[#2E281D] bg-[#2E281D]"
        aria-label="Grille de Sudoku"
      >
        {puzzle.cells.map((given, index) => {
          const row = Math.floor(index / 9);
          const column = index % 9;
          return (
            <input
              key={index}
              aria-label={`Ligne ${row + 1}, colonne ${column + 1}`}
              inputMode="numeric"
              maxLength={1}
              pattern="[1-9]"
              value={values[index]}
              readOnly={Boolean(given) || completed || !playable}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/[^1-9]/g, "").slice(-1);
                setValues((current) =>
                  current.map((value, cellIndex) =>
                    cellIndex === index ? nextValue : value,
                  ),
                );
              }}
              className={`min-w-0 border-b border-r border-[#7D6C49]/45 text-center font-serif text-base font-black outline-none focus:relative focus:z-10 focus:bg-[#FFF7D9] focus:ring-2 focus:ring-[#9B263D] ${
                given ? "bg-[#DCC99F] text-[#2E281D]" : "bg-[#FFFDF5] text-[#9B263D]"
              } ${column % 3 === 2 && column !== 8 ? "border-r-2 border-r-[#2E281D]" : ""} ${
                row % 3 === 2 && row !== 8 ? "border-b-2 border-b-[#2E281D]" : ""
              }`}
            />
          );
        })}
      </div>
    </GameForm>
  );
}

function CrosswordGame({
  editionId,
  puzzle,
  playable,
  initiallyCompleted,
}: {
  editionId: string;
  puzzle: CyclogazetteCrosswordPuzzle;
  playable: boolean;
  initiallyCompleted: boolean;
}) {
  const openCells = useMemo(
    () => new Map(puzzle.cells.map((cell) => [cell.index, cell])),
    [puzzle.cells],
  );
  const [values, setValues] = useState<string[]>(() =>
    Array.from({ length: puzzle.rows * puzzle.columns }, (_, index) =>
      openCells.has(index) ? "" : "#",
    ),
  );
  const [state, formAction, pending] = useActionState(
    validateCyclogazetteGameAction,
    initialCyclogazetteGameActionState,
  );
  const completed = initiallyCompleted || state.result === "success";
  useRefreshAfterSuccess(state.result);

  return (
    <GameForm
      editionId={editionId}
      gameType="crossword"
      answer={values.join("")}
      difficulty={puzzle.difficulty}
      playable={playable}
      completed={completed}
      result={state.result}
      pending={pending}
      formAction={formAction}
    >
      <div
        className="mx-auto grid w-full max-w-[310px] border-2 border-[#2E281D] bg-[#2E281D]"
        style={{ gridTemplateColumns: `repeat(${puzzle.columns}, minmax(0, 1fr))` }}
        aria-label="Grille de mots croisés"
      >
        {Array.from({ length: puzzle.rows * puzzle.columns }, (_, index) => {
          const cell = openCells.get(index);
          if (!cell) {
            return <span key={index} className="aspect-square bg-[#2E281D]" />;
          }
          return (
            <label
              key={index}
              className="relative aspect-square min-w-0 border-b border-r border-[#7D6C49]/45 bg-[#FFFDF5]"
            >
              {cell.number ? (
                <span className="pointer-events-none absolute left-px top-0 text-[6px] font-black leading-none text-[#655A43]">
                  {cell.number}
                </span>
              ) : null}
              <span className="sr-only">
                Ligne {cell.row + 1}, colonne {cell.column + 1}
              </span>
              <input
                maxLength={1}
                value={values[index] === "#" ? "" : values[index]}
                readOnly={completed || !playable}
                onChange={(event) => {
                  const nextValue = event.target.value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(-1);
                  setValues((current) =>
                    current.map((value, cellIndex) =>
                      cellIndex === index ? nextValue : value,
                    ),
                  );
                }}
                className="h-full w-full min-w-0 bg-transparent pt-1 text-center font-serif text-[clamp(9px,2vw,14px)] font-black uppercase text-[#9B263D] outline-none focus:bg-[#FFF7D9] focus:ring-2 focus:ring-inset focus:ring-[#9B263D]"
              />
            </label>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 text-[10px] leading-4 text-[#514833] sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {(["horizontal", "vertical"] as const).map((direction) => (
          <div key={direction}>
            <p className="border-b border-[#7D6C49]/40 pb-1 font-black uppercase tracking-[0.12em] text-[#9B263D]">
              {direction === "horizontal" ? "Horizontal" : "Vertical"}
            </p>
            <ol className="mt-2 space-y-1 font-serif">
              {puzzle.entries
                .filter((entry) => entry.direction === direction)
                .map((entry) => (
                  <li key={`${entry.number}:${entry.direction}`}>
                    <strong>{entry.number}.</strong> {entry.clue}
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
    </GameForm>
  );
}

function GameForm({
  editionId,
  gameType,
  answer,
  difficulty,
  playable,
  completed,
  result,
  pending,
  formAction,
  children,
}: {
  editionId: string;
  gameType: GameTab;
  answer: string;
  difficulty: CyclogazetteGameDifficulty;
  playable: boolean;
  completed: boolean;
  result: "idle" | "success" | "failure";
  pending: boolean;
  formAction: (payload: FormData) => void;
  children: React.ReactNode;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  return (
    <form action={formAction}>
      <input type="hidden" name="editionId" value={editionId} />
      <input type="hidden" name="gameType" value={gameType} />
      <input type="hidden" name="answer" value={answer} />
      <div className="mb-3 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.14em]">
        <span className="text-[#655A43]">{isEnglish ? "Level" : "Niveau"}</span>
        <span className="border border-[#9B263D]/35 bg-[#F8E9E7] px-2 py-1 text-[#9B263D]">
          {difficulty}
        </span>
      </div>
      {children}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={!playable || completed || pending}
          className="min-h-10 flex-1 border border-[#2E281D] bg-[#2E281D] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#FFF6DE] transition hover:bg-[#9B263D] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending
            ? isEnglish
              ? "Checking…"
              : "Vérification…"
            : isEnglish
              ? "Validate"
              : "Valider"}
        </button>
        {completed || result === "failure" ? (
          <p
            aria-live="polite"
            className={`min-w-[74px] border px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.1em] ${
              completed
                ? "border-[#2E725D]/40 bg-[#DCEDE4] text-[#176951]"
                : "border-[#9B263D]/40 bg-[#F4DDDA] text-[#9B263D]"
            }`}
          >
            {completed
              ? isEnglish
                ? "Success"
                : "Succès"
              : isEnglish
                ? "Failure"
                : "Échec"}
          </p>
        ) : null}
      </div>
      {!playable ? (
        <p className="mt-2 text-center font-serif text-[10px] italic text-[#655A43]">
          {isEnglish
            ? "Archived issue: validation is closed."
            : "Édition archivée : les validations sont closes."}
        </p>
      ) : null}
    </form>
  );
}

function YesterdaySolutions({
  solutions,
  isEnglish,
}: {
  solutions: CyclogazetteGamesOverview["previousSolutions"];
  isEnglish: boolean;
}) {
  if (!solutions) return null;

  return (
    <details className="group border-t-4 border-double border-[#2E281D] px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.16em] text-[#655A43] marker:hidden">
        <span>
          {isEnglish ? "Yesterday’s answers" : "Réponses de la veille"} · N° {solutions.issueNumber}
        </span>
        <span className="transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3 grid grid-cols-[auto_1fr] items-start gap-4">
        <div className="grid grid-cols-9 border border-[#2E281D] bg-white">
          {solutions.sudokuRows.join("").split("").map((value, index) => (
            <span
              key={index}
              className="flex h-3.5 w-3.5 items-center justify-center border-b border-r border-[#7D6C49]/25 font-serif text-[7px] font-bold"
            >
              {value}
            </span>
          ))}
        </div>
        <div
          className="grid justify-self-end border border-[#2E281D] bg-[#2E281D]"
          style={{
            gridTemplateColumns: `repeat(${solutions.crosswordRows[0]?.length ?? 1}, 0.875rem)`,
          }}
        >
          {solutions.crosswordRows.join("").split("").map((value, index) => (
            <span
              key={index}
              className={`flex h-3.5 w-3.5 items-center justify-center border-b border-r border-[#7D6C49]/25 font-serif text-[7px] font-bold ${
                value === "#" ? "bg-[#2E281D]" : "bg-white"
              }`}
            >
              {value === "#" ? "" : value}
            </span>
          ))}
        </div>
      </div>
    </details>
  );
}

function DailyCompleters({
  completers,
  total,
  isEnglish,
}: {
  completers: CyclogazetteGamesOverview["completers"];
  total: number;
  isEnglish: boolean;
}) {
  return (
    <section className="border-t border-[#7D6C49]/40 bg-[#E8D9B8]/65 px-4 py-4">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9B263D]">
        {isEnglish ? "Today’s finishers" : "Les joueurs du jour"}
      </p>
      {completers.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {completers.map((player) => (
            <li
              key={player.directorName}
              className="flex items-center justify-between gap-2 border-b border-[#7D6C49]/25 pb-1 font-serif text-xs font-bold"
            >
              <span className="truncate">{player.directorName}</span>
              <span className="shrink-0 text-[9px] font-black text-[#176951]">
                {player.completedGames.includes("sudoku") ? "S" : ""}
                {player.completedGames.includes("crossword") ? "M" : ""}
              </span>
            </li>
          ))}
          {total > completers.length ? (
            <li className="pt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#655A43]">
              + {total - completers.length} {isEnglish ? "others" : "autres"}
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-2 font-serif text-xs italic leading-5 text-[#655A43]">
          {isEnglish
            ? "The first perfect grid is still awaited."
            : "La rédaction attend encore la première grille parfaite."}
        </p>
      )}
      <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.1em] text-[#7A6C50]">
        S · Sudoku &nbsp; M · {isEnglish ? "Crossword" : "Mots croisés"}
      </p>
    </section>
  );
}

function DailyPoll({
  poll,
  playable,
  isEnglish,
}: {
  poll: NonNullable<CyclogazetteGamesOverview["poll"]>;
  playable: boolean;
  isEnglish: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    voteCyclogazettePollAction,
    initialCyclogazettePollActionState,
  );
  const viewerOptionId =
    poll.viewerOptionId ??
    (state.result === "success" ? state.optionId : null);
  const showResults = Boolean(viewerOptionId) || !playable;
  useRefreshAfterSuccess(state.result);

  return (
    <section className="border-t-4 border-double border-[#2E281D] bg-[#F7EDD4] px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9B263D]">
          {isEnglish ? "Daily poll" : "Le sondage du jour"}
        </p>
        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#655A43]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9B263D]" />
          {isEnglish ? "Live" : "En direct"}
        </span>
      </div>
      <h3 className="mt-3 font-serif text-lg font-black leading-6 text-[#2E281D]">
        {poll.question}
      </h3>

      {showResults ? (
        <div className="mt-4 space-y-3">
          {poll.options.map((option) => {
            const percentage =
              poll.totalVotes > 0
                ? Math.round((option.votes / poll.totalVotes) * 100)
                : 0;
            const selected = option.id === viewerOptionId;
            return (
              <div key={option.id}>
                <div className="flex items-end justify-between gap-3 text-[10px] font-bold">
                  <span className={selected ? "text-[#9B263D]" : "text-[#514833]"}>
                    {option.label}
                    {selected
                      ? isEnglish
                        ? " · Your choice"
                        : " · Votre choix"
                      : ""}
                  </span>
                  <strong className="tabular-nums text-[#2E281D]">
                    {percentage} %
                  </strong>
                </div>
                <div className="mt-1 h-2 overflow-hidden border border-[#7D6C49]/35 bg-[#E2D4B4]">
                  <span
                    className={`block h-full transition-[width] duration-500 ${
                      selected ? "bg-[#9B263D]" : "bg-[#2E725D]"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#75694F]">
            {poll.totalVotes} {isEnglish ? "vote(s) recorded" : "vote(s) enregistré(s)"}
          </p>
        </div>
      ) : (
        <form action={formAction} className="mt-4 space-y-2">
          <input type="hidden" name="pollId" value={poll.id} />
          {poll.options.map((option) => (
            <button
              key={option.id}
              type="submit"
              name="optionId"
              value={option.id}
              disabled={pending}
              className="block min-h-10 w-full border border-[#7D6C49]/45 bg-[#FFF9E9] px-3 py-2 text-left font-serif text-xs font-bold text-[#403829] transition hover:border-[#9B263D] hover:bg-[#F4DFD9] hover:text-[#7B1D31] disabled:cursor-wait disabled:opacity-55"
            >
              {option.label}
            </button>
          ))}
          {state.result === "failure" ? (
            <p aria-live="polite" className="pt-1 text-center text-[10px] font-black text-[#9B263D]">
              {isEnglish ? "Vote failed." : "Le vote n’a pas pu être enregistré."}
            </p>
          ) : null}
        </form>
      )}

      {!playable && !viewerOptionId ? (
        <p className="mt-3 font-serif text-[10px] italic text-[#655A43]">
          {isEnglish ? "This poll is closed." : "Ce sondage est désormais clos."}
        </p>
      ) : null}
    </section>
  );
}

function useRefreshAfterSuccess(result: "idle" | "success" | "failure") {
  const router = useRouter();
  useEffect(() => {
    if (result === "success") router.refresh();
  }, [result, router]);
}

function formatCash(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    value,
  );
}
