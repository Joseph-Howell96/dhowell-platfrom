import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A server action takes one megabyte by default, and a photograph of a
      // receipt off an iPad is three to five - so a real receipt was refused
      // before any of this app's code ran, with nothing able to say why.
      //
      // Pictures are shrunk in the browser first (see shrink-photo.ts), which
      // is the actual fix; this is the backstop for one that could not be, and
      // it stops short of the four and a half megabytes the platform itself
      // allows, because past that the refusal comes from below us and is not
      // ours to explain.
      bodySizeLimit: "4mb",
    },
  },

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
