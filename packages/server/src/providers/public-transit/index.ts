import { boundary } from "../stub";
export const adapter = boundary(
  "public-transit",
  ["local_transit", "walking", "transfer"],
  [],
  "Timetable data is not bookable inventory; regional source and licensing unresolved.",
);
