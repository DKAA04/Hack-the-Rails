import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@wayward/contracts", "@wayward/server"],
  poweredByHeader: false,
};
export default config;
