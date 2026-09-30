/**
 * Prints the Palantir MCP inputs for the Cs object types and link types in scripts/lib/ontology.ts:
 * the empty backing dataset schema and the object type property list for each type, and each link type.
 * Edit-only properties (arrays, and properties added later) have no dataset column. Only Actions write them.
 * Run: npm run -s ontology:payloads > <file>
 */
import { DOCUMENT_FIELDS, LINK_TYPES, OBJECT_TYPES, type PropertyKind, type PropertySpec } from "./lib/ontology.js";

/** Foundry adds this prefix to every object type ID on this enrollment (docs/foundry-resources.md). */
const FOUNDRY_ID_PREFIX = "fvhlhlrq.";

const ARRAY_KINDS: ReadonlySet<PropertyKind> = new Set(["stringArray", "documentArray"]);
const isEditOnly = (property: PropertySpec): boolean => property.editOnly === true || ARRAY_KINDS.has(property.kind);

const camel = (id: string): string => id.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
const displayName = (id: string): string => {
  const words = id.split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function datasetColumn(property: PropertySpec): Record<string, unknown> {
  const base = { name: property.id, nullable: true, description: property.description };
  switch (property.kind) {
    case "string":
    case "longText":
      return { ...base, type: "string" };
    case "integer":
    case "long":
    case "boolean":
    case "date":
      return { ...base, type: property.kind };
    case "timestamp":
      return { ...base, type: "timestamp", dateFormat: "yyyy-MM-dd'T'HH:mm:ssX" };
    case "stringArray":
    case "documentArray":
      throw new Error(`${property.id} is edit-only and has no dataset column.`);
  }
}

function propertyType(kind: PropertyKind): Record<string, unknown> {
  switch (kind) {
    case "string":
      return { type: "string" };
    case "longText":
      return { type: "string", string: { isLongText: true, supportsExactMatching: false } };
    case "integer":
    case "long":
    case "boolean":
    case "date":
    case "timestamp":
      return { type: kind };
    case "stringArray":
      return { type: "array", array: { type: "string" } };
    case "documentArray":
      return {
        type: "array",
        array: {
          type: "struct",
          struct: DOCUMENT_FIELDS.map((field) => ({
            apiName: field.apiName,
            displayName: displayName(field.apiName.replace(/([A-Z])/g, "_$1").toLowerCase()),
            fieldType: { type: field.kind },
          })),
        },
      };
  }
}

function columnFromSource(property: PropertySpec): string {
  if (property.source === undefined) {
    throw new Error(`${property.id} has no source column in the existing dataset.`);
  }
  return property.source;
}

const kebab = (apiName: string): string => apiName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
const title = (apiName: string): string => {
  const words = apiName.replace(/([A-Z])/g, " $1");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const objectTypes = OBJECT_TYPES.map((type) => ({
  apiName: type.apiName,
  existingDataset: type.existingDataset ?? null,
  objectTypeId: kebab(type.apiName),
  datasetName: type.apiName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(),
  datasetSchema: type.properties.filter((property) => !isEditOnly(property)).map(datasetColumn),
  csvHeader: type.properties
    .filter((property) => !isEditOnly(property))
    .map((property) => property.id)
    .join(","),
  objectType: {
    apiName: type.apiName,
    displayName: type.displayName,
    pluralDisplayName: type.pluralDisplayName,
    description: type.description,
    icon: { iconName: type.icon, iconColor: "#2D72D2" },
    primaryKey: type.primaryKey,
    titlePropertyTypeId: type.title,
    propertyTypes: type.properties.map((property) => ({
      propertyTypeId: property.id,
      apiName: camel(property.id),
      displayMetadata: { displayName: displayName(property.id), description: property.description },
      type: propertyType(property.kind),
      isNullable: property.nullable,
    })),
    propertyMapping: type.properties.map((property) => ({
      propertyTypeId: property.id,
      mappingInfo: isEditOnly(property)
        ? { type: "editOnly" }
        : { type: "column", column: type.existingDataset === undefined ? property.id : columnFromSource(property) },
    })),
  },
}));

const primaryKeyOf = (apiName: string): string => {
  const type = OBJECT_TYPES.find((candidate) => candidate.apiName === apiName);
  if (type === undefined) throw new Error(`Unknown object type ${apiName}.`);
  return type.primaryKey;
};

const linkTypes = LINK_TYPES.map((link) => ({
  linkTypeId: link.id,
  apiName: camel(link.id.replaceAll("-", "_")),
  displayName: title(camel(link.id.replaceAll("-", "_"))),
  pluralDisplayName: title(camel(link.id.replaceAll("-", "_"))),
  linkTypeCardinality: "ONE_TO_MANY",
  leftSide: { objectTypeId: FOUNDRY_ID_PREFIX + kebab(link.one), propertyId: primaryKeyOf(link.one) },
  rightSide: { objectTypeId: FOUNDRY_ID_PREFIX + kebab(link.many), propertyId: link.foreignKey },
  leftToRightLinkMetadata: { apiName: link.toMany, displayName: title(link.toMany), pluralDisplayName: title(link.toMany) },
  rightToLeftLinkMetadata: { apiName: link.toOne, displayName: title(link.toOne), pluralDisplayName: `${title(link.toOne)}s` },
}));

console.log(JSON.stringify({ objectTypes, linkTypes }, null, 2));
