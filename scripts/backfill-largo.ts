/**
 * Completa el "largo" (corto | medio | largo) de las prendas ya subidas que no lo tienen.
 * Sirve para vestir el maniquí: sin largo, un short se colocaría hasta la rodilla.
 *
 * Uso:  npm run backfill:largo           (solo prendas sin largo)
 *       npm run backfill:largo -- --dry  (muestra qué haría, sin guardar)
 */
import { z } from "zod";
import { aiChat, isAiConfigured, tokenBudget } from "../src/lib/ai.js";
import { prisma } from "../src/lib/prisma.js";
import { storage } from "../src/lib/storage.js";
import { LARGOS } from "../src/modules/garments/garments.schemas.js";
import { forAiVision } from "../src/modules/processing/image.js";
import { extractJson } from "../src/modules/processing/tagging.schema.js";

const dry = process.argv.includes("--dry");
const CON_LARGO = ["top", "bottom", "vestido", "outerwear"] as const;

const SYSTEM = `Eres una estilista. Dada la foto de una prenda, indica su largo para vestir un maniquí.
Responde SOLO con JSON: {"largo": "corto" | "medio" | "largo"}
- top: "corto" = crop top o llega a la cintura; "medio" = llega a la cadera; "largo" = pasa la cadera (túnica, camisa larga).
- bottom: "corto" = short o minifalda; "medio" = llega a la rodilla o a media pierna (falda midi, capri); "largo" = pantalón largo, falda maxi.
- vestido: "corto" = sobre la rodilla; "medio" = a la rodilla o a media pierna; "largo" = maxi, hasta el tobillo.
- outerwear: "corto" = hasta la cintura; "medio" = hasta la cadera; "largo" = hasta el muslo o más.`;

const answer = z.object({ largo: z.enum(LARGOS) });

async function main() {
  if (!isAiConfigured()) {
    console.error("La IA no está configurada (falta la clave del proveedor).");
    process.exit(1);
  }

  const rows = await prisma.garment.findMany({
    where: { deletedAt: null, estadoProcesamiento: "ready", largo: null, categoria: { in: [...CON_LARGO] }, urlSinFondo: { not: null } },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${rows.length} prendas sin largo${dry ? " (modo prueba: no se guarda nada)" : ""}`);

  let done = 0;
  for (const g of rows) {
    try {
      const jpeg = await forAiVision(await storage.getBuffer(g.urlSinFondo!));
      const reply = await aiChat({
        system: SYSTEM,
        image: jpeg,
        maxTokens: tokenBudget(64),
        text: `Categoría: ${g.categoria}. Tipo: ${g.subcategoria ?? "desconocido"}. Indica el largo en JSON.`,
      });
      const { largo } = answer.parse(extractJson(reply));
      console.log(`  ${g.categoria}/${g.subcategoria ?? "?"} -> ${largo}`);
      if (!dry) await prisma.garment.update({ where: { id: g.id }, data: { largo } });
      done++;
    } catch (err) {
      console.error(`  ${g.categoria}/${g.subcategoria ?? "?"} -> falló: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`Listo: ${done}/${rows.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
