import localFont from "next/font/local";

// Self-hosted variable fonts. Latin and Latin Extended are separate families so
// Central European place names (Kraków, Łódź, Plzeň) fall back per glyph to the
// extended subset instead of to a system font.
export const bricolageLatin = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  weight: "200 800",
  variable: "--font-bricolage-latin",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
export const bricolageExt = localFont({
  src: "./fonts/bricolage-grotesque-latin-ext.woff2",
  weight: "200 800",
  variable: "--font-bricolage-ext",
  display: "swap",
  preload: false,
});
export const interLatin = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter-latin",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
export const interExt = localFont({
  src: "./fonts/inter-latin-ext.woff2",
  weight: "100 900",
  variable: "--font-inter-ext",
  display: "swap",
  preload: false,
});

export const fontVariables = [
  bricolageLatin.variable,
  bricolageExt.variable,
  interLatin.variable,
  interExt.variable,
].join(" ");
