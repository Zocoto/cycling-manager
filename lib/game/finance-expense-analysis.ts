export const FINANCE_EXPENSE_CATEGORY_DEFINITIONS = [
  {
    key: "rider_salaries",
    label: "Salaires coureurs",
    description: "Rémunérations contractuelles de l’effectif professionnel",
    color: "#176951",
  },
  {
    key: "staff_salaries",
    label: "Salaires du staff",
    description: "Rémunérations contractuelles de l’encadrement",
    color: "#42B99A",
  },
  {
    key: "transfers",
    label: "Transferts et coureurs",
    description: "Achats, indemnités et mouvements de coureurs",
    color: "#F2C94C",
  },
  {
    key: "equipment",
    label: "Matériel et R&D",
    description: "Achats d’équipement et recherche matérielle",
    color: "#2E6F9E",
  },
  {
    key: "infrastructure",
    label: "Infrastructures",
    description: "Construction et développement des installations",
    color: "#315B3E",
  },
  {
    key: "nutrition",
    label: "Nutrition",
    description: "Interventions et programmes nutritionnels",
    color: "#E58B3A",
  },
  {
    key: "form_camps",
    label: "Stages de forme",
    description: "Stages classiques et premium de remise en forme",
    color: "#C75E4A",
  },
  {
    key: "medical_care",
    label: "Soins médicaux",
    description: "Traitements des blessures et protocoles médicaux",
    color: "#D9697A",
  },
  {
    key: "training",
    label: "Entraînement",
    description: "Séances et autres dépenses de performance",
    color: "#7A68A6",
  },
  {
    key: "race_preparation",
    label: "Préparation des courses",
    description: "Reconnaissances et préparation ciblée des épreuves",
    color: "#4B8BBE",
  },
  {
    key: "youth_development",
    label: "Formation des jeunes",
    description: "Détection, accueil, scolarité et Development Team",
    color: "#72D4B7",
  },
  {
    key: "staff_management",
    label: "Gestion et formation du staff",
    description: "Recrutement, départ, naturalisation et perfectionnement",
    color: "#A17928",
  },
  {
    key: "fan_club",
    label: "Fan Club et boutique",
    description: "Déplacements de supporters et achats de stock",
    color: "#C76AA5",
  },
  {
    key: "other",
    label: "Autres dépenses",
    description: "Mouvements ne relevant d’aucun poste spécialisé",
    color: "#789087",
  },
] as const;

export type FinanceExpenseCategoryKey =
  (typeof FINANCE_EXPENSE_CATEGORY_DEFINITIONS)[number]["key"];

export type FinanceExpenseSourceTransaction = {
  id: string;
  amount: number;
  category: string;
  status: "pending" | "posted" | "cancelled";
  sourceReference: string;
};

export type FinanceExpenseBreakdownItem = {
  key: FinanceExpenseCategoryKey;
  label: string;
  description: string;
  color: string;
  amount: number;
  postedAmount: number;
  pendingAmount: number;
  percentage: number;
  transactionCount: number;
};

export type FinanceExpenseAnalysis = {
  totalAmount: number;
  postedAmount: number;
  pendingAmount: number;
  salaryAmount: number;
  salaryPercentage: number;
  breakdown: FinanceExpenseBreakdownItem[];
};

export function buildFinanceExpenseAnalysis(
  transactions: readonly FinanceExpenseSourceTransaction[],
): FinanceExpenseAnalysis {
  const expenses = transactions.filter(
    (transaction) => transaction.amount < 0 && transaction.status !== "cancelled",
  );
  const totals = new Map<
    FinanceExpenseCategoryKey,
    { amount: number; postedAmount: number; pendingAmount: number; count: number }
  >();

  for (const transaction of expenses) {
    const key = classifyFinanceExpense(transaction);
    const amount = Math.abs(transaction.amount);
    const current = totals.get(key) ?? {
      amount: 0,
      postedAmount: 0,
      pendingAmount: 0,
      count: 0,
    };
    current.amount += amount;
    current.count += 1;
    if (transaction.status === "posted") current.postedAmount += amount;
    else current.pendingAmount += amount;
    totals.set(key, current);
  }

  const totalAmount = [...totals.values()].reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const definitionOrder = new Map(
    FINANCE_EXPENSE_CATEGORY_DEFINITIONS.map((definition, index) => [
      definition.key,
      index,
    ]),
  );
  const breakdown = FINANCE_EXPENSE_CATEGORY_DEFINITIONS.flatMap(
    (definition): FinanceExpenseBreakdownItem[] => {
      const total = totals.get(definition.key);
      if (!total || total.amount <= 0) return [];
      return [
        {
          ...definition,
          amount: total.amount,
          postedAmount: total.postedAmount,
          pendingAmount: total.pendingAmount,
          percentage: totalAmount > 0 ? (total.amount / totalAmount) * 100 : 0,
          transactionCount: total.count,
        },
      ];
    },
  ).sort(
    (left, right) =>
      right.amount - left.amount ||
      (definitionOrder.get(left.key) ?? 0) -
        (definitionOrder.get(right.key) ?? 0),
  );
  const postedAmount = breakdown.reduce(
    (sum, item) => sum + item.postedAmount,
    0,
  );
  const pendingAmount = breakdown.reduce(
    (sum, item) => sum + item.pendingAmount,
    0,
  );
  const salaryAmount = breakdown
    .filter(
      (item) =>
        item.key === "rider_salaries" || item.key === "staff_salaries",
    )
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    totalAmount,
    postedAmount,
    pendingAmount,
    salaryAmount,
    salaryPercentage: totalAmount > 0 ? (salaryAmount / totalAmount) * 100 : 0,
    breakdown,
  };
}

export function classifyFinanceExpense(
  transaction: Pick<
    FinanceExpenseSourceTransaction,
    "category" | "sourceReference"
  >,
): FinanceExpenseCategoryKey {
  const source = transaction.sourceReference.trim().toLowerCase();

  if (startsWithAny(source, ["nutrition-intervention:"])) return "nutrition";
  if (startsWithAny(source, ["form-camp:", "form-camp-batch:"])) {
    return "form_camps";
  }
  if (startsWithAny(source, ["race-reconnaissance:"])) {
    return "race_preparation";
  }
  if (
    startsWithAny(source, [
      "youth-signing:",
      "youth-tuition:",
      "development-race:",
      "youth-dismissal:",
    ])
  ) {
    return "youth_development";
  }
  if (
    startsWithAny(source, [
      "staff-signing:",
      "staff-dismissal:",
      "staff-academy-training:",
      "staff-naturalization:",
    ])
  ) {
    return "staff_management";
  }
  if (startsWithAny(source, ["fan-club:", "fan-club-wholesale:"])) {
    return "fan_club";
  }
  if (startsWithAny(source, ["rider-dismissal:"])) return "transfers";

  if (transaction.category === "rider_salary") return "rider_salaries";
  if (transaction.category === "staff_salary") return "staff_salaries";
  if (transaction.category === "transfer") return "transfers";
  if (transaction.category === "equipment") return "equipment";
  if (transaction.category === "building") return "infrastructure";
  if (transaction.category === "medical_care") return "medical_care";
  if (transaction.category === "training") return "training";
  return "other";
}

function startsWithAny(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}
