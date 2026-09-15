import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The clients screen used to live at /customers. Anyone with that address
  // bookmarked is sent to the new one rather than hitting a missing page.
  // Marked temporary (not permanent) so browsers do not cache it forever
  // while the app is still changing shape.
  redirects: async () => [
    { source: "/customers", destination: "/clients", permanent: false },
    { source: "/customers/new", destination: "/clients/new", permanent: false },
  ],
};

export default nextConfig;
