"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { PurchaseFinancialRisk } from "@/lib/game/purchase-financial-risk";

type Continuation =
  | {
      kind: "form";
      form: HTMLFormElement;
      submitter: HTMLButtonElement | HTMLInputElement | null;
    }
  | { kind: "click"; element: HTMLElement };

type WarningState =
  | { kind: "risk"; risk: PurchaseFinancialRisk; label: string | null }
  | { kind: "unavailable"; label: string | null };

export function FinancialRiskWarningProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [warning, setWarning] = useState<WarningState | null>(null);
  const continuationRef = useRef<Continuation | null>(null);
  const checkingRef = useRef(false);
  const bypassedFormsRef = useRef(new WeakSet<HTMLFormElement>());
  const bypassedElementsRef = useRef(new WeakSet<HTMLElement>());

  useEffect(() => {
    async function checkAndContinue(
      expense: number,
      label: string | null,
      continuation: Continuation,
    ) {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const response = await fetch("/api/finance/purchase-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expense }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Financial check failed: ${response.status}`);

        const risk = (await response.json()) as PurchaseFinancialRisk;
        if (risk.requiresConfirmation) {
          continuationRef.current = continuation;
          setWarning({ kind: "risk", risk, label });
          return;
        }

        continuePurchase(
          continuation,
          bypassedFormsRef.current,
          bypassedElementsRef.current,
        );
      } catch (error) {
        console.error("purchase_financial_risk_check_failed", error);
        continuationRef.current = continuation;
        setWarning({ kind: "unavailable", label });
      } finally {
        checkingRef.current = false;
      }
    }

    function onSubmit(event: SubmitEvent) {
      if (!(event.target instanceof HTMLFormElement)) return;
      const form = event.target;
      if (!form.hasAttribute("data-financial-expense") &&
          !form.hasAttribute("data-financial-expense-field")) return;

      if (bypassedFormsRef.current.has(form)) {
        bypassedFormsRef.current.delete(form);
        return;
      }

      const expense = readExpense(form);
      if (expense <= 0) return;

      event.preventDefault();
      const rawSubmitter = event.submitter;
      const submitter =
        rawSubmitter instanceof HTMLButtonElement ||
        rawSubmitter instanceof HTMLInputElement
          ? rawSubmitter
          : null;
      void checkAndContinue(
        expense,
        form.dataset.financialLabel ?? null,
        { kind: "form", form, submitter },
      );
    }

    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>(
        "[data-financial-expense]",
      );
      if (!element || element instanceof HTMLFormElement) return;
      if (element.closest("form[data-financial-expense], form[data-financial-expense-field]")) {
        return;
      }

      if (bypassedElementsRef.current.has(element)) {
        bypassedElementsRef.current.delete(element);
        return;
      }

      const expense = readExpense(element);
      if (expense <= 0) return;

      event.preventDefault();
      event.stopPropagation();
      void checkAndContinue(
        expense,
        element.dataset.financialLabel ?? null,
        { kind: "click", element },
      );
    }

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    if (!warning) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        continuationRef.current = null;
        setWarning(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [warning]);

  function cancel() {
    continuationRef.current = null;
    setWarning(null);
  }

  function confirm() {
    const continuation = continuationRef.current;
    continuationRef.current = null;
    setWarning(null);
    if (!continuation) return;
    continuePurchase(
      continuation,
      bypassedFormsRef.current,
      bypassedElementsRef.current,
    );
  }

  return (
    <>
      {children}
      {warning ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="financial-risk-warning-title"
          aria-describedby="financial-risk-warning-description"
          className="fixed inset-0 z-[400] flex items-center justify-center bg-[#041411]/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-[1.75rem] border border-[#F2C94C]/45 bg-[#FFFDF4] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.48)] sm:p-8">
            <div
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1BE] text-2xl font-black text-[#8A6516]"
            >
              !
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#9A7415]">
              Alerte budget
            </p>
            <h2
              id="financial-risk-warning-title"
              className="mt-2 text-2xl font-black text-[#071A17]"
            >
              {warning.kind === "risk"
                ? "Projection financière dans le rouge"
                : "Projection financière indisponible"}
            </h2>
            <div
              id="financial-risk-warning-description"
              className="mt-3 space-y-3 text-sm font-semibold leading-6 text-[#526861]"
            >
              {warning.kind === "risk" ? (
                <>
                  <p>
                    {warning.risk.wasAlreadyNegative
                      ? `Votre projection de fin de saison est déjà négative. Cette dépense${warning.label ? ` pour ${warning.label}` : ""} la porterait à ${formatMoney(warning.risk.projectedBalanceAfterPurchase, warning.risk.currency)}.`
                      : `Cette dépense${warning.label ? ` pour ${warning.label}` : ""} ferait passer votre projection de fin de saison à ${formatMoney(warning.risk.projectedBalanceAfterPurchase, warning.risk.currency)}.`}
                  </p>
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#E4D5A2] bg-white p-4 text-xs">
                    <FinancialMetric
                      label="Avant l’achat"
                      value={formatMoney(
                        warning.risk.currentProjectedBalance,
                        warning.risk.currency,
                      )}
                    />
                    <FinancialMetric
                      label="Après l’achat"
                      value={formatMoney(
                        warning.risk.projectedBalanceAfterPurchase,
                        warning.risk.currency,
                      )}
                      danger
                    />
                  </div>
                  <p>
                    Les revenus et charges déjà programmés sont inclus dans ce
                    calcul. Vous pouvez poursuivre, mais l’équipe s’expose aux
                    conséquences d’une trésorerie négative.
                  </p>
                </>
              ) : (
                <p>
                  La projection de fin de saison n’a pas pu être recalculée.
                  Revenez en arrière pour consulter vos finances, ou poursuivez
                  cette dépense en connaissance de cause.
                </p>
              )}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                autoFocus
                onClick={cancel}
                className="min-h-12 rounded-xl border border-[#315B3E]/20 bg-white px-4 text-xs font-black uppercase tracking-[0.1em] text-[#183F37] transition hover:bg-[#F2F6F4]"
              >
                Revenir
              </button>
              <button
                type="button"
                onClick={confirm}
                className="min-h-12 rounded-xl bg-[#A44635] px-4 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#803326]"
              >
                Confirmer l’achat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FinancialMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div>
      <p className="font-black uppercase tracking-[0.1em] text-[#718079]">
        {label}
      </p>
      <p className={`mt-1 text-base font-black ${danger ? "text-[#A44635]" : "text-[#183F37]"}`}>
        {value}
      </p>
    </div>
  );
}

function readExpense(element: HTMLElement) {
  const directExpense = toPositiveNumber(element.dataset.financialExpense);
  const extraExpense = toPositiveNumber(
    element.dataset.financialExtraExpense,
  );
  const fieldName = element.dataset.financialExpenseField;
  const fieldExpense =
    fieldName && element instanceof HTMLFormElement
      ? toPositiveNumber(new FormData(element).get(fieldName))
      : 0;

  return directExpense + extraExpense + fieldExpense;
}

function toPositiveNumber(value: FormDataEntryValue | string | undefined | null) {
  if (typeof value !== "string") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function continuePurchase(
  continuation: Continuation,
  bypassedForms: WeakSet<HTMLFormElement>,
  bypassedElements: WeakSet<HTMLElement>,
) {
  if (continuation.kind === "form") {
    if (!continuation.form.isConnected) return;
    bypassedForms.add(continuation.form);
    continuation.form.requestSubmit(continuation.submitter ?? undefined);
    return;
  }

  if (!continuation.element.isConnected) return;
  bypassedElements.add(continuation.element);
  continuation.element.click();
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
