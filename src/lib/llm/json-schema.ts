import { z } from "zod";

/**
 * Gemini's responseJsonSchema accepts a subset of JSON Schema (listed in the
 * @google/genai type docs, 2.31): $id, $defs, $ref, $anchor, type, format,
 * title, description, enum, items, prefixItems, minItems, maxItems, minimum,
 * maximum, anyOf, oneOf, properties, additionalProperties, required,
 * propertyOrdering. Everything else is dropped here; `const` becomes a
 * one-value enum. Zod still validates the full schema on our side.
 */
const SUPPORTED = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

type Json = Record<string, unknown>;

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== "object") return node;
  const out: Json = {};
  for (const [k, v] of Object.entries(node as Json)) {
    if (k === "const") {
      out.enum = [v];
      continue;
    }
    if (!SUPPORTED.has(k)) continue;
    if (k === "properties" || k === "$defs") {
      out[k] = Object.fromEntries(Object.entries(v as Json).map(([name, sub]) => [name, clean(sub)]));
    } else {
      out[k] = clean(v);
    }
  }
  return out;
}

/**
 * JSON Schema for the model's output. Uses Zod's input shape, so fields with
 * defaults are optional for the model and filled in by Zod afterwards.
 */
export function toGeminiSchema(schema: z.ZodType): Json {
  return clean(z.toJSONSchema(schema, { io: "input", target: "draft-2020-12", unrepresentable: "any" })) as Json;
}
