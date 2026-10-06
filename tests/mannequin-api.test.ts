import { describe, expect, it } from "vitest";
import { updateProfileSchema, FIGURAS, TONOS_PIEL } from "../src/modules/auth/auth.schemas.js";
import { updateGarmentSchema } from "../src/modules/garments/garments.schemas.js";
import { parseTagging } from "../src/modules/processing/tagging.schema.js";

const tags = {
  categoria: "bottom",
  subcategoria: "falda midi",
  colores: [{ nombre: "rosa", hex: "#E48FB0" }],
  patron: "liso",
  material: "algodón",
  formalidad: 2,
  temporadas: ["verano"],
  ocasiones: ["casual"],
  descripcion: "Falda midi rosa",
};

describe("largo de la prenda (para vestir el maniquí)", () => {
  it("el etiquetado acepta corto, medio y largo", () => {
    expect(parseTagging(JSON.stringify({ ...tags, largo: "medio" })).largo).toBe("medio");
    expect(parseTagging(JSON.stringify({ ...tags, largo: "largo" })).largo).toBe("largo");
  });

  it("si el modelo omite el largo o manda null, el etiquetado sigue siendo válido", () => {
    expect(parseTagging(JSON.stringify(tags)).largo ?? null).toBeNull();
    expect(parseTagging(JSON.stringify({ ...tags, largo: null })).largo ?? null).toBeNull();
  });

  it("un largo inventado no invalida el resto de las etiquetas", () => {
    const parsed = parseTagging(JSON.stringify({ ...tags, largo: "extra-largo" }));
    expect(parsed.largo ?? null).toBeNull();
    expect(parsed.categoria).toBe("bottom");
  });

  it("se puede corregir a mano, y solo con valores válidos", () => {
    expect(updateGarmentSchema.safeParse({ largo: "corto" }).success).toBe(true);
    expect(updateGarmentSchema.safeParse({ largo: null }).success).toBe(true);
    expect(updateGarmentSchema.safeParse({ largo: "enorme" }).success).toBe(false);
  });
});

describe("maniquí elegido en el perfil", () => {
  it("acepta cada figura y cada tono del catálogo", () => {
    for (const figura of FIGURAS) expect(updateProfileSchema.safeParse({ figura }).success).toBe(true);
    for (const tonoPiel of TONOS_PIEL) expect(updateProfileSchema.safeParse({ tonoPiel }).success).toBe(true);
  });

  it("rechaza figuras o tonos desconocidos y permite volver al predeterminado (null)", () => {
    expect(updateProfileSchema.safeParse({ figura: "inventada" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ tonoPiel: "azul" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ figura: null, tonoPiel: null }).success).toBe(true);
  });

  it("el catálogo del API coincide con el de la app", async () => {
    // Si alguien agrega una figura en la app y olvida el API (o al revés), la elección se rechazaría.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../outfit-de-mi-novia/src/features/mannequin/figure.ts", import.meta.url), "utf8");
    const appFiguras = [...src.matchAll(/id: "(\w+)", nombre: "\w+", shoulder/g)].map((m) => m[1]);
    const appTonos = [...src.matchAll(/id: "(\w+)", nombre: "[^"]+", color:/g)].map((m) => m[1]);
    expect(appFiguras).toEqual([...FIGURAS]);
    expect(appTonos).toEqual([...TONOS_PIEL]);
  });
});
