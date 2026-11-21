import { boundary } from "../stub";
export const adapter = boundary(
  "omio",
  ["flight", "rail", "coach", "ferry"],
  [],
  "Partner access unresolved. No private endpoints assumed.",
);
