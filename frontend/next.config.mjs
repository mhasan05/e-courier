/** @type {import('next').NextConfig} */
const nextConfig = {
  // Windows build mitigation: the parallel page-data worker intermittently
  // throws "Cannot find module for page" during `next build`. Disabling worker
  // threads / extra CPUs serializes page-data collection and avoids the race.
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
