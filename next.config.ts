import path from "node:path";
import type { NextConfig } from "next";

const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  // Fija la raíz del workspace al directorio del proyecto.
  // Sin esto, Turbopack puede inferir /Users/ivan/Documents como raíz
  // porque hay múltiples proyectos hermanos y falla al resolver módulos.
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
