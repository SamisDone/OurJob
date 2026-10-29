import { z } from "zod";
import { withUser } from "@/lib/api";
import { configuredModels } from "@/lib/llm";
import { profileDb } from "@/lib/profile/service";
import { getTailorModel, setTailorModel, tailorModelSchema } from "@/lib/settings/store";

/** GET: the tailoring model he chose and the models this deployment offers. PUT: change it. */
export const GET = withUser(async (_req, { user }) => ({
  tailorModel: await getTailorModel(profileDb(), user.id),
  models: configuredModels(),
}));

export const PUT = withUser(async (req, { user }) => {
  const { tailorModel } = z.object({ tailorModel: tailorModelSchema }).parse(await req.json());
  const models = configuredModels();
  // Without LLM_THOROUGH_MODEL there is only one model to use.
  const chosen = tailorModel === "thorough" && !models.thorough ? "standard" : tailorModel;
  return { tailorModel: await setTailorModel(profileDb(), user.id, chosen), models };
});
