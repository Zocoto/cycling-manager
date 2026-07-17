import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const scriptsDirectory = path.dirname(currentFilePath);
const projectDirectory = path.resolve(scriptsDirectory, "..");
const namesDirectory = path.join(projectDirectory, "data", "rider-names");
const catalogPath = path.join(namesDirectory, "profiles.json");

function normalizeValue(value) {
  return value
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function findDuplicates(values) {
  const encounteredValues = new Map();
  const duplicates = new Set();

  for (const value of values) {
    const normalizedValue = normalizeValue(value);

    if (encounteredValues.has(normalizedValue)) {
      duplicates.add(value.trim());
    } else {
      encounteredValues.set(normalizedValue, value.trim());
    }
  }

  return [...duplicates].sort((firstValue, secondValue) =>
    firstValue.localeCompare(secondValue, "fr"),
  );
}

function validateStringList({
  values,
  fieldName,
  profileCode,
  minimumCount,
  errors,
}) {
  if (!Array.isArray(values)) {
    errors.push(
      `[${profileCode}] Le champ "${fieldName}" doit être un tableau.`,
    );
    return;
  }

  const invalidValues = values.filter(
    (value) => typeof value !== "string" || value.trim().length === 0,
  );

  if (invalidValues.length > 0) {
    errors.push(
      `[${profileCode}] Le champ "${fieldName}" contient ${invalidValues.length} valeur(s) vide(s) ou invalide(s).`,
    );
  }

  const validValues = values.filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

  if (validValues.length < minimumCount) {
    errors.push(
      `[${profileCode}] Le champ "${fieldName}" contient ${validValues.length} entrée(s), alors que ${minimumCount} sont requises.`,
    );
  }

  const duplicates = findDuplicates(validValues);

  if (duplicates.length > 0) {
    errors.push(
      `[${profileCode}] Doublon(s) dans "${fieldName}" : ${duplicates.join(", ")}.`,
    );
  }
}

async function readJsonFile(filePath) {
  const rawContent = await readFile(filePath, "utf8");

  try {
    return JSON.parse(rawContent);
  } catch (error) {
    throw new Error(
      `JSON invalide dans ${path.relative(projectDirectory, filePath)} : ${error.message}`,
    );
  }
}

async function validateCatalog() {
  const catalog = await readJsonFile(catalogPath);
  const errors = [];

  if (
    !Number.isInteger(catalog.minimumFirstNames) ||
    catalog.minimumFirstNames < 1
  ) {
    errors.push(
      'Le champ "minimumFirstNames" de profiles.json doit être un entier positif.',
    );
  }

  if (
    !Number.isInteger(catalog.minimumLastNames) ||
    catalog.minimumLastNames < 1
  ) {
    errors.push(
      'Le champ "minimumLastNames" de profiles.json doit être un entier positif.',
    );
  }

  if (!Array.isArray(catalog.profiles) || catalog.profiles.length === 0) {
    errors.push(
      'Le champ "profiles" de profiles.json doit contenir au moins un profil.',
    );
  }

  if (errors.length > 0) {
    return {
      catalog,
      errors,
      validatedProfiles: [],
    };
  }

  const profileCodes = catalog.profiles.map((profile) => profile.code);
  const duplicateProfileCodes = findDuplicates(profileCodes);

  if (duplicateProfileCodes.length > 0) {
    errors.push(
      `Code(s) de profil dupliqué(s) dans profiles.json : ${duplicateProfileCodes.join(", ")}.`,
    );
  }

  const availableFiles = await readdir(namesDirectory);
  const expectedFileNames = new Set(
    catalog.profiles.map((profile) => `${profile.code}.json`),
  );

  const unexpectedJsonFiles = availableFiles
    .filter(
      (fileName) =>
        fileName.endsWith(".json") &&
        fileName !== "profiles.json" &&
        !expectedFileNames.has(fileName),
    )
    .sort();

  if (unexpectedJsonFiles.length > 0) {
    errors.push(
      `Fichier(s) JSON sans profil déclaré : ${unexpectedJsonFiles.join(", ")}.`,
    );
  }

  const validatedProfiles = [];

  for (const profile of catalog.profiles) {
    if (
      typeof profile.code !== "string" ||
      !/^[a-z0-9_]+$/.test(profile.code)
    ) {
      errors.push(
        `Code de profil invalide dans profiles.json : ${String(profile.code)}.`,
      );
      continue;
    }

    if (
      typeof profile.label !== "string" ||
      profile.label.trim().length === 0
    ) {
      errors.push(
        `[${profile.code}] Le libellé du profil est vide ou invalide.`,
      );
    }

    const profileFilePath = path.join(
      namesDirectory,
      `${profile.code}.json`,
    );

    let profileData;

    try {
      profileData = await readJsonFile(profileFilePath);
    } catch (error) {
      errors.push(
        `[${profile.code}] Fichier absent ou illisible : ${error.message}`,
      );
      continue;
    }

    if (profileData.code !== profile.code) {
      errors.push(
        `[${profile.code}] Le champ "code" du fichier doit être exactement "${profile.code}".`,
      );
    }

    validateStringList({
      values: profileData.firstNames,
      fieldName: "firstNames",
      profileCode: profile.code,
      minimumCount: catalog.minimumFirstNames,
      errors,
    });

    validateStringList({
      values: profileData.lastNames,
      fieldName: "lastNames",
      profileCode: profile.code,
      minimumCount: catalog.minimumLastNames,
      errors,
    });

    validatedProfiles.push({
      code: profile.code,
      label: profile.label,
      firstNameCount: Array.isArray(profileData.firstNames)
        ? profileData.firstNames.length
        : 0,
      lastNameCount: Array.isArray(profileData.lastNames)
        ? profileData.lastNames.length
        : 0,
    });
  }

  return {
    catalog,
    errors,
    validatedProfiles,
  };
}

async function main() {
  try {
    const result = await validateCatalog();

    if (result.errors.length > 0) {
      console.error("\nValidation des bibliothèques de noms : ÉCHEC\n");

      for (const error of result.errors) {
        console.error(`- ${error}`);
      }

      console.error(
        `\n${result.errors.length} erreur(s) détectée(s).\n`,
      );

      process.exitCode = 1;
      return;
    }

    const totalFirstNames = result.validatedProfiles.reduce(
      (total, profile) => total + profile.firstNameCount,
      0,
    );

    const totalLastNames = result.validatedProfiles.reduce(
      (total, profile) => total + profile.lastNameCount,
      0,
    );

    console.log("\nValidation des bibliothèques de noms : SUCCÈS\n");

    for (const profile of result.validatedProfiles) {
      console.log(
        `- ${profile.code} : ${profile.firstNameCount} prénoms, ${profile.lastNameCount} noms`,
      );
    }

    console.log(
      `\n${result.validatedProfiles.length} profils validés.`,
    );
    console.log(`${totalFirstNames} prénoms disponibles.`);
    console.log(`${totalLastNames} noms disponibles.\n`);
  } catch (error) {
    console.error("\nImpossible de valider les bibliothèques de noms.\n");
    console.error(error);
    process.exitCode = 1;
  }
}

await main();