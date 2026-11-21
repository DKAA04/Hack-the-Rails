import { z } from "zod";
export const DependencyHealthSchema = z.object({
  version: z.literal(1),
  database: z.object({
    configured: z.boolean(),
    connectivity: z.enum(["not_checked", "verified", "failed"]),
  }),
  searchStorage: z.enum(["postgresql", "development_file", "unconfigured"]),
  checkoutPolicy: z.literal("per_order_test_only").optional(),
  stripe: z.object({
    credentialsPresent: z.boolean(),
    webhookSecretPresent: z.boolean(),
    connectivity: z.literal("not_checked"),
    checkoutEnabled: z.literal(false),
  }),
});
export type DependencyHealth = z.infer<typeof DependencyHealthSchema>;
