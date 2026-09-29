/**
 * Prints the Palantir MCP inputs for the Cs object types in scripts/lib/ontology.ts:
 * the empty backing dataset schema and the object type property list, for each type.
 * Edit-only properties (arrays, and properties added later) have no dataset column. Only Actions write them.
 * Run: npm run -s ontology:payloads > <file>
 */
import { DOCUMENT_FIELDS, OBJECT_TYPES, type PropertyKind, type PropertySpec } from "./lib/ontology.js";

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

const payloads = OBJECT_TYPES.map((type) => ({
  apiName: type.apiName,
  existingDataset: type.existingDataset ?? null,
  objectTypeId: type.apiName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(),
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

console.log(JSON.stringify(payloads, null, 2));
