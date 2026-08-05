/** Route, not a static file, so it stays outside the auth middleware and keeps the right content type. */
export function GET() {
  return Response.json(
    {
      name: "Cadence",
      short_name: "Cadence",
      description: "Time tracking and a backlog, for one person.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#f8fafc",
      theme_color: "#2a78d6",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
