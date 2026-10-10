import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(64);
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: "Enter a valid email address." }));
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.")
  .regex(/[a-zA-Z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");
export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);
export const isoDateSchema = z.iso.datetime({ offset: true, message: "Enter a valid date and time." });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export function parseSearchParams<T extends z.ZodType>(schema: T, params: URLSearchParams | Record<string, string | undefined>): z.output<T> {
  const obj = params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params;
  return schema.parse(obj) as z.output<T>;
}
