import { z } from "zod";
import { ModeSchema, PlaceSchema, UtcSchema } from "./common";
export const PlaceLookupRequestSchema = z.object({
  query: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  modes: z.array(ModeSchema).min(1).optional(),
});
export type PlaceLookupRequest = z.infer<typeof PlaceLookupRequestSchema>;
export const PlaceLookupSourceSchema = z.object({
  id: z.string(),
  status: z.enum(["ok", "unconfigured", "unavailable", "unsupported"]),
  message: z.string().nullable(),
  attribution: z.string(),
  url: z.url(),
});
export type PlaceLookupSource = z.infer<typeof PlaceLookupSourceSchema>;
export const PlaceLookupResponseSchema = z.object({
  version: z.literal(1),
  query: z.string(),
  places: z.array(PlaceSchema),
  sources: z.array(PlaceLookupSourceSchema),
  warnings: z.array(z.string()),
  fetchedAt: UtcSchema,
});
export type PlaceLookupResponse = z.infer<typeof PlaceLookupResponseSchema>;
