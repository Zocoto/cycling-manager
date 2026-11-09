const sponsorObjectiveBadgeStyles = {
  principal: {
    label: "Objectif sponsor principal",
    title: "Objectif sponsor principal",
    icon: "!",
    className: "bg-[#8B5CF6] text-white",
  },
  secondary: {
    label: "Objectif sponsor secondaire",
    title: "Objectif sponsor secondaire",
    icon: "2",
    className: "border border-[#8B5CF6]/45 bg-[#E8DDFD] text-[#4E2685]",
  },
  affinity: {
    label: "Affinité sportive",
    title: "Affinité sportive — aucune prime contractuelle dédiée",
    icon: "♡",
    className: "border border-[#71548D]/50 bg-white text-[#71548D]",
  },
};

export function SponsorObjectiveBadge({
  compact = false,
  kind = "principal",
}: {
  compact?: boolean;
  kind?: keyof typeof sponsorObjectiveBadgeStyles;
}) {
  const { label, title, icon, className } = sponsorObjectiveBadgeStyles[kind];
  return (
    <span
      role="img"
      aria-label={label}
      title={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black shadow-sm ${className} ${compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs"}`}
    >
      {icon}
    </span>
  );
}
