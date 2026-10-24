import type {GameNavigationGroupId} from "@/lib/game/game-navigation";

const paths: Record<GameNavigationGroupId,string> = {
  team:"M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 19v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6m2 3a5 5 0 0 1 4 5v1",
  races:"M5 21V3m0 0c5-4 9 4 15 0v10c-6 4-10-4-15 0",
  equipment:"M7 7 4 4l2-2 4 4-1 4 10 10-3 2L6 11l-4-1V6l4 2m8 1 6-6m-7 15-5 4-3-3 4-5",
  club:"M3 8h18v13H3ZM6 8V3h12v5M8 13h8m-8 4h5",
  federation:"M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM3 9h18M12 2v20",
  community:"M3 3h18v14h-8l-6 5v-5H3ZM7 7h10M7 11h7",
};
export function GameNavigationIcon({group,className="h-5 w-5"}: {group: GameNavigationGroupId;className?: string}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[group]}/></svg>;
}
