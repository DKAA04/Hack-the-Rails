import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  transpilePackages: ["@wayward/contracts", "@wayward/server"],
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, "../.."),
};
export default config;
