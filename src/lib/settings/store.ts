import { eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/profile/store";

export const tailorModelSchema = z.enum(["standard", "thorough"]);
export type TailorModel = z.infer<typeof tailorModelSchema>;

/** Which model tailors his CVs, chosen in Settings. Anything unexpected reads as "standard". */
export async function getTailorModel(db: Db, userId: string): Promise<TailorModel> {
  const [row] = await db.select({ m: schema.users.tailorModel }).from(schema.users).where(eq(schema.users.id, userId));
  return tailorModelSchema.catch("standard").parse(row?.m);
}

export async function setTailorModel(db: Db, userId: string, model: TailorModel): Promise<TailorModel> {
  await db.update(schema.users).set({ tailorModel: model }).where(eq(schema.users.id, userId));
  return model;
}
