export type GameNavigationGroupId = "team" | "races" | "equipment" | "club" | "federation" | "community";
export type GameNavigationLink = readonly [label: string, href: string];
export type GameNavigationGroup = {
  readonly id: GameNavigationGroupId;
  readonly label: string;
  readonly links: ReadonlyArray<GameNavigationLink>;
};

// One route inventory for desktop, mobile and the dashboard. No remote reads,
// account fetching or event/private-page exposure is performed by this module.
export const NAVIGATION_GROUPS_FR: ReadonlyArray<GameNavigationGroup> = [
  {id:"team",label:"Équipe & staff",links:[
    ["Mon équipe","/jeu/equipe"], ["Effectif & contrats","/jeu/effectif"],
    ["Transferts","/jeu/transferts"], ["Entraînements","/jeu/entrainement"],
    ["Soins & nutrition","/jeu/centre-de-soin"], ["Staff","/jeu/staff"],
    ["Centre de formation","/jeu/centre-de-formation"],
  ]},
  {id:"races",label:"Courses & résultats",links:[
    ["Calendrier & inscriptions","/jeu/calendrier"], ["Préparation de course","/jeu/preparation-course"],
    ["Directs, résultats & replays","/jeu/resultats"], ["Classements UCI","/jeu/classements"],
    ["Rivalités","/jeu/rivalites"],
  ]},
  {id:"equipment",label:"Matériel & inventaire",links:[
    ["Boutique de matériel","/jeu/materiel"], ["Équiper les coureurs","/jeu/materiel/equiper"],
    ["Équipementier","/jeu/materiel/equipementier"], ["Laboratoire R&D","/jeu/materiel/laboratoire"],
    ["Inventaire","/jeu/inventaire"],
  ]},
  {id:"club",label:"Gestion du club",links:[
    ["Finances","/jeu/finances"], ["Sponsoring","/jeu/sponsoring"],
    ["Infrastructures","/jeu/infrastructures"], ["Fan-club & boutique","/jeu/fan-club"],
    ["Objectifs & trophées","/jeu/objectifs"],
  ]},
  {id:"federation",label:"Fédération & championnats",links:[
    ["Ma fédération","/jeu/federation"], ["Convocations de mes coureurs","/jeu/selections-internationales"],
    ["Championnats nationaux","/jeu/championnats-nationaux"],
    ["Championnats internationaux","/jeu/championnats-internationaux"],
  ]},
  {id:"community",label:"Vie du jeu & aide",links:[
    ["La Cyclogazette","/jeu/gazette"], ["Actualités du jeu","/jeu/nouveautes"],
    ["Chat du peloton","/jeu/chat"], ["Annuaire","/jeu/recherche"], ["Guide du jeu","/jeu/guide"],
  ]},
];

export const NAVIGATION_GROUPS_EN: ReadonlyArray<GameNavigationGroup> = [
  {id:"team",label:"Team & staff",links:[
    ["My team","/jeu/equipe"], ["Squad & contracts","/jeu/effectif"],
    ["Transfers","/jeu/transferts"], ["Training","/jeu/entrainement"],
    ["Care & nutrition","/jeu/centre-de-soin"], ["Staff","/jeu/staff"],
    ["Youth development","/jeu/centre-de-formation"],
  ]},
  {id:"races",label:"Races & results",links:[
    ["Calendar & entries","/jeu/calendrier"], ["Race preparation","/jeu/preparation-course"],
    ["Live, results & replays","/jeu/resultats"], ["UCI rankings","/jeu/classements"],
    ["Rivalries","/jeu/rivalites"],
  ]},
  {id:"equipment",label:"Equipment & inventory",links:[
    ["Equipment shop","/jeu/materiel"], ["Equip riders","/jeu/materiel/equiper"],
    ["Equipment partner","/jeu/materiel/equipementier"], ["R&D laboratory","/jeu/materiel/laboratoire"],
    ["Inventory","/jeu/inventaire"],
  ]},
  {id:"club",label:"Club management",links:[
    ["Finances","/jeu/finances"], ["Sponsorship","/jeu/sponsoring"],
    ["Infrastructure","/jeu/infrastructures"], ["Fan club & shop","/jeu/fan-club"],
    ["Objectives & trophies","/jeu/objectifs"],
  ]},
  {id:"federation",label:"Federation & championships",links:[
    ["My federation","/jeu/federation"], ["My riders’ call-ups","/jeu/selections-internationales"],
    ["National championships","/jeu/championnats-nationaux"],
    ["International championships","/jeu/championnats-internationaux"],
  ]},
  {id:"community",label:"Community & help",links:[
    ["La Cyclogazette","/jeu/gazette"], ["Game news","/jeu/nouveautes"],
    ["Peloton chat","/jeu/chat"], ["Directory","/jeu/recherche"], ["Game guide","/jeu/guide"],
  ]},
];

// Preserve the already-public gala entry separately from permanent management.
// Album, Halloween and private/admin shortcuts retain their existing gates.
export const NAVIGATION_EVENTS_FR: ReadonlyArray<GameNavigationLink> = [["Le Grand Gala · Saison 4","/jeu/gala-saison-4"]];
export const NAVIGATION_EVENTS_EN: ReadonlyArray<GameNavigationLink> = [["The Grand Gala · Season 4","/jeu/gala-saison-4"]];

export function getGameNavigationGroups({locale="fr",federationCountryCode,showJerseyWorkshop=false}: {
  locale?: string;
  federationCountryCode?: string | null;
  showJerseyWorkshop?: boolean;
} = {}): ReadonlyArray<GameNavigationGroup> {
  const english=locale==="en";
  const country=federationCountryCode?.trim().toLowerCase();
  return (english?NAVIGATION_GROUPS_EN:NAVIGATION_GROUPS_FR).map(group=>{
    if(group.id==="team"&&showJerseyWorkshop) return {...group,links:[
      group.links[0], [english?"Jersey workshop":"Atelier du maillot","/jeu/maillot"] as const, ...group.links.slice(1),
    ]};
    if(group.id==="federation"&&country&&/^[a-z]{2}$/.test(country)) return {...group,links:[
      [group.links[0][0],`/jeu/federations/${country}`] as const,...group.links.slice(1),
    ]};
    return group;
  });
}

export function getActiveGameNavigationHref(groups: ReadonlyArray<GameNavigationGroup>, pathname: string) {
  let match: string | null=null;
  for(const group of groups) for(const [,href] of group.links) {
    if((pathname===href||pathname.startsWith(`${href}/`))&&href.length>(match?.length??0)) match=href;
  }
  return match;
}

export function getActiveGameNavigationGroupId(groups: ReadonlyArray<GameNavigationGroup>,pathname: string): GameNavigationGroupId | null {
  const href=getActiveGameNavigationHref(groups,pathname);
  if(href) return groups.find(group=>group.links.some(([,target])=>target===href))?.id??null;
  if(pathname.startsWith("/jeu/coureurs/")) return "team";
  if(pathname.startsWith("/jeu/courses/")||pathname.startsWith("/jeu/gala-")) return "races";
  if(pathname.startsWith("/jeu/federations/")||pathname.startsWith("/jeu/nations/")) return "federation";
  return null;
}
