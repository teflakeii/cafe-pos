/** @type {import('next').NextConfig} */
const path = require("node:path");

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  turbopack: {
    root: path.join(__dirname, "../../"),
  },
};

module.exports = nextConfig;
