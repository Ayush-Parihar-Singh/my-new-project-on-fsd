import { z } from "zod";
import { emailSchema, passwordSchema } from "./common";

export const registerSchema = z.object({
  role: z.enum(["DONOR", "NGO", "VOLUNTEER"], { message: "Choose how you want to take part." }),
  fullName: z.string().trim().min(2, "Enter your full name.").max(100),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { message: "Please accept the community guidelines to continue." }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
