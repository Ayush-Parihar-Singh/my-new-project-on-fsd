import { apiRoute, json, readJson } from "@/lib/http";
import { resetPasswordSchema } from "@/validation/auth";
import { resetPassword } from "@/server/services/auth.service";

export const POST = apiRoute(async (req) => {
  const input = await readJson(req, resetPasswordSchema);
  await resetPassword(input);
  return json({ ok: true, message: "Your password has been updated. Please sign in with the new password." });
});
