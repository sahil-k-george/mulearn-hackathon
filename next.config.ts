import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs (used for PDF text extraction) ships prebuilt ESM that should not be
  // bundled by Turbopack.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
