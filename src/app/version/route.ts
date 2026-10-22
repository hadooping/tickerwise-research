// Which version of the website is live, for the "new version available" banner (update-banner.tsx). A page that
// has been open for hours keeps running the code it first loaded; it asks this every so often and offers a
// reload when the answer changes. It runs on every request (force-dynamic, no-store), so it always gives the
// version that's live now rather than a copy saved when the site was built.
export const dynamic = "force-dynamic";

export function GET() {
  // Vercel sets these on every deployment: the deployment's own id, or the commit it was built from. Locally
  // neither is set, so the version is "dev" and never changes.
  const version = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
