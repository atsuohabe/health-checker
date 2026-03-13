import type { NextConfig } from "next";
import { execSync } from "child_process";
import pkg from "./package.json" with { type: "json" };

const gitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: `${pkg.version}+${gitHash}`,
  },
};

export default nextConfig;
