import { DashboardView } from "@/components/dashboard/DashboardView";
import { getLanguageSafe } from "@/server/settings";
import { metadataTitle } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: metadataTitle(await getLanguageSafe(), "page.dashboard") };
}

export default function DashboardPage() {
  return <DashboardView />;
}