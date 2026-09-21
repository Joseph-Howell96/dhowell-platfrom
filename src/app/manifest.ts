import type { MetadataRoute } from "next";

/**
 * What an operating system reads when Dennis is pinned to a dock, a taskbar
 * or a home screen, rather than just opened in a tab.
 *
 * The two big icons matter more than they look. A dock asks for the largest
 * picture on offer and shrinks it to fit; with nothing bigger than a browser
 * tab's sixteen pixels to work from, it blows that up instead, and the result
 * is the fuzzy square you get from enlarging a stamp.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dennis",
    short_name: "Dennis",
    description: "Internal platform for D Howell & Sons.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // A separate drawing for platforms that crop an icon into a circle or a
      // squircle of their own. Offering none of these gets the tile a white
      // border put round it, which rather undoes the all-black; offering this
      // one unchanged would let the crop take the corners off the D. So the
      // tile goes to the edges, where the mask wants it, and the letter sits
      // in smaller, inside the part that is certain to survive.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
