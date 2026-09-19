import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source rather than built output.
  transpilePackages: ['@scrinode/types', '@scrinode/scripture', '@scrinode/validation'],
};

export default config;
