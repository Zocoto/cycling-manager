import { randomInt } from "node:crypto";

import andean from "../../data/rider-names/andean.json";
import balkans from "../../data/rider-names/balkans.json";
import belgium from "../../data/rider-names/belgium.json";
import brazil from "../../data/rider-names/brazil.json";
import britishIsles from "../../data/rider-names/british_isles.json";
import caribbean from "../../data/rider-names/caribbean.json";
import caucasus from "../../data/rider-names/caucasus.json";
import centralAfrica from "../../data/rider-names/central_africa.json";
import centralAsia from "../../data/rider-names/central_asia.json";
import centralEurope from "../../data/rider-names/central_europe.json";
import china from "../../data/rider-names/china.json";
import eastAfrica from "../../data/rider-names/east_africa.json";
import easternEurope from "../../data/rider-names/eastern_europe.json";
import france from "../../data/rider-names/france.json";
import germany from "../../data/rider-names/germany.json";
import greece from "../../data/rider-names/greece.json";
import iran from "../../data/rider-names/iran.json";
import israel from "../../data/rider-names/israel.json";
import italy from "../../data/rider-names/italy.json";
import japan from "../../data/rider-names/japan.json";
import korea from "../../data/rider-names/korea.json";
import mexicoCentralAmerica from "../../data/rider-names/mexico_central_america.json";
import middleEastArabic from "../../data/rider-names/middle_east_arabic.json";
import netherlands from "../../data/rider-names/netherlands.json";
import nordic from "../../data/rider-names/nordic.json";
import northAfrica from "../../data/rider-names/north_africa.json";
import northAmerica from "../../data/rider-names/north_america.json";
import oceania from "../../data/rider-names/oceania.json";
import portugal from "../../data/rider-names/portugal.json";
import southAsia from "../../data/rider-names/south_asia.json";
import southeastAsia from "../../data/rider-names/southeast_asia.json";
import southernAfrica from "../../data/rider-names/southern_africa.json";
import southernCone from "../../data/rider-names/southern_cone.json";
import spain from "../../data/rider-names/spain.json";
import turkey from "../../data/rider-names/turkey.json";
import westAfricaAnglophone from "../../data/rider-names/west_africa_anglophone.json";
import westAfricaFrancophone from "../../data/rider-names/west_africa_francophone.json";

const INITIAL_RIDER_COUNT = 7;

type RiderNameLibrary = {
  code: string;
  firstNames: string[];
  lastNames: string[];
};

export type GeneratedRiderIdentity = {
  first_name: string;
  last_name: string;
  avatar_seed: string;
};

const riderNameLibraries = {
  france,
  belgium,
  netherlands,
  italy,
  spain,
  portugal,
  germany,
  british_isles: britishIsles,
  nordic,
  central_europe: centralEurope,
  balkans,
  eastern_europe: easternEurope,
  greece,
  caucasus,
  turkey,
  north_america: northAmerica,
  mexico_central_america: mexicoCentralAmerica,
  andean,
  southern_cone: southernCone,
  brazil,
  caribbean,
  japan,
  korea,
  china,
  southeast_asia: southeastAsia,
  south_asia: southAsia,
  central_asia: centralAsia,
  north_africa: northAfrica,
  middle_east_arabic: middleEastArabic,
  israel,
  iran,
  west_africa_francophone: westAfricaFrancophone,
  west_africa_anglophone: westAfricaAnglophone,
  central_africa: centralAfrica,
  east_africa: eastAfrica,
  southern_africa: southernAfrica,
  oceania,
} satisfies Record<string, RiderNameLibrary>;

export function generateInitialRiderIdentities(
  profileCode: string
): GeneratedRiderIdentity[] {
  const library = getRiderNameLibrary(profileCode);

  const selectedFirstNames = selectUniqueValues(
    library.firstNames,
    INITIAL_RIDER_COUNT
  );

  const selectedLastNames = selectUniqueValues(
    library.lastNames,
    INITIAL_RIDER_COUNT
  );

  const usedAvatarSeeds = new Set<string>();

  return Array.from(
    { length: INITIAL_RIDER_COUNT },
    (_, index) => ({
      first_name: selectedFirstNames[index].trim(),
      last_name: selectedLastNames[index].trim(),
      avatar_seed: createUniqueAvatarSeed(usedAvatarSeeds),
    })
  );
}

function getRiderNameLibrary(
  profileCode: string
): RiderNameLibrary {
  const library =
    riderNameLibraries[
      profileCode as keyof typeof riderNameLibraries
    ];

  if (!library) {
    throw new Error(
      `La bibliothèque de noms "${profileCode}" est introuvable.`
    );
  }

  if (library.code !== profileCode) {
    throw new Error(
      `Le code interne de la bibliothèque "${profileCode}" est incohérent.`
    );
  }

  if (
    library.firstNames.length < INITIAL_RIDER_COUNT ||
    library.lastNames.length < INITIAL_RIDER_COUNT
  ) {
    throw new Error(
      `La bibliothèque "${profileCode}" ne contient pas assez d’identités.`
    );
  }

  return library;
}

function selectUniqueValues(
  values: readonly string[],
  count: number
): string[] {
  if (values.length < count) {
    throw new Error(
      `Impossible de sélectionner ${count} valeurs distinctes.`
    );
  }

  const shuffledValues = [...values];

  for (let index = 0; index < count; index += 1) {
    const selectedIndex = randomInt(
      index,
      shuffledValues.length
    );

    [
      shuffledValues[index],
      shuffledValues[selectedIndex],
    ] = [
      shuffledValues[selectedIndex],
      shuffledValues[index],
    ];
  }

  return shuffledValues.slice(0, count);
}

function createUniqueAvatarSeed(
  usedSeeds: Set<string>
): string {
  while (true) {
    const firstPart = randomInt(
      1_000_000,
      10_000_000
    ).toString();

    const secondPart = randomInt(
      100_000_000,
      1_000_000_000
    ).toString();

    const serializedSeed = `${firstPart}${secondPart}`;

    if (!usedSeeds.has(serializedSeed)) {
      usedSeeds.add(serializedSeed);
      return serializedSeed;
    }
  }
}