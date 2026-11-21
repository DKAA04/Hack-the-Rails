import { boundary } from "../stub";
export const adapter = boundary(
  "all-aboard",
  ["rail"],
  ["ALL_ABOARD_API_KEY"],
  "Access and supported operations need verification.",
);
