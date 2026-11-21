import { boundary } from "../stub";
export const adapter = boundary(
  "duffel",
  ["flight"],
  ["DUFFEL_ACCESS_TOKEN"],
  "Access and sandbox/live account must be verified; no adapter requests implemented.",
);
