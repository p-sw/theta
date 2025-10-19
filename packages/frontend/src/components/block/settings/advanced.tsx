import { SettingsSection, SettingsSubSection } from "@/components/layout/settings";
import { Switch } from "@/components/ui/switch";
import { useDeveloperMode } from "@/lib/storage-hooks";

export function Advanced() {
  const [developerMode, setDeveloperMode] = useDeveloperMode();

  return (
    <SettingsSection
      id={"settings-advanced"}
      title="Advanced"
      description="Power-user options for diagnostics and development."
    >
      <SettingsSubSection title="Developer">
        <div className="flex items-center justify-between border rounded-md p-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Developer Mode</span>
            <span className="text-xs text-muted-foreground">Shows developer stuff</span>
          </div>
          <Switch checked={developerMode} onCheckedChange={setDeveloperMode} />
        </div>
      </SettingsSubSection>
    </SettingsSection>
  );
}
