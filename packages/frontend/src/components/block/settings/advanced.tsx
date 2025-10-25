import { SettingsSection, SettingsSubSection } from "@/components/layout/settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAdvanced } from "@/lib/storage-hooks";

export function AdvancedSettings() {
  const [advanced, setAdvanced] = useAdvanced();

  return (
    <SettingsSection id="settings-advanced" title="Advanced">
      <SettingsSubSection title="Display">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="advanced-show-token-count"
              checked={advanced.showTokenCount}
              onCheckedChange={(v) =>
                setAdvanced((prev) => ({ ...prev, showTokenCount: Boolean(v) }))
              }
            />
            <Label htmlFor="advanced-show-token-count">Show token count</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="advanced-show-tool-details"
              checked={advanced.showToolDetails}
              onCheckedChange={(v) =>
                setAdvanced((prev) => ({ ...prev, showToolDetails: Boolean(v) }))
              }
            />
            <Label htmlFor="advanced-show-tool-details">Show tool details</Label>
          </div>
        </div>
      </SettingsSubSection>
    </SettingsSection>
  );
}
