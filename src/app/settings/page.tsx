import { SettingsView } from "@/components/settings/SettingsView";
import { getLanguageSafe } from "@/server/settings";
import { metadataTitle } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: metadataTitle(await getLanguageSafe(), "page.settings") };
}

export default function SettingsPage() {
  return <SettingsView />;
}