import { SettingsSection, SettingsSubSection } from "@/components/layout/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SYNC_ENABLED_KEY, SYNC_KEY_KEY } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { enableSyncWithExisting, generateNewSyncKey } from "@/lib/sync";
import { toast } from "sonner";

export function SyncSettings() {
  const [enabledStr, setEnabledStr] = useStorage<string>(SYNC_ENABLED_KEY, "false");
  const enabled = enabledStr === "true";
  const [syncKey, setSyncKey] = useStorage<string>(SYNC_KEY_KEY, "");
  const [existingKeyInput, setExistingKeyInput] = useState("");
  const hasKey = useMemo(() => syncKey.length > 0, [syncKey]);

  useEffect(() => {
    if (!enabled) return;
    if (!hasKey) return;
    // Nothing else to do here; the sync daemon runs globally
  }, [enabled, hasKey]);

  const onGenerate = async () => {
    try {
      const key = await generateNewSyncKey();
      setSyncKey(key);
      setEnabledStr("true");
      toast.success("Sync key generated and sync enabled");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate and upload initial sync data");
    }
  };

  const onUseExisting = async () => {
    const key = existingKeyInput.trim();
    if (!key) {
      toast.error("Please enter a sync key");
      return;
    }
    try {
      await enableSyncWithExisting(key);
      setSyncKey(key);
      setEnabledStr("true");
      toast.success("Synced from existing key and enabled");
    } catch (e) {
      console.error(e);
      toast.error("Failed to join with existing sync key");
    }
  };

  const onDisable = () => {
    setEnabledStr("false");
  };

  const onCopy = async () => {
    if (!hasKey) return;
    await navigator.clipboard.writeText(syncKey);
    toast.success("Sync key copied");
  };

  return (
    <SettingsSection
      id="settings-sync"
      title="Sync"
      description="Keep your data synchronized across devices using a private Sync Key."
    >
      <SettingsSubSection title="Status">
        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={(c) => setEnabledStr(c ? "true" : "false")} />
          <Label>{enabled ? "Enabled" : "Disabled"}</Label>
        </div>
      </SettingsSubSection>

      {!enabled && (
        <SettingsSubSection title="Enable Sync">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter existing Sync Key"
                value={existingKeyInput}
                onChange={(e) => setExistingKeyInput(e.target.value)}
              />
              <Button onClick={onUseExisting}>Use Key</Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                Or generate a new Sync Key and upload your current data
              </div>
              <Button variant="secondary" onClick={onGenerate}>
                Generate New Key
              </Button>
            </div>
          </div>
        </SettingsSubSection>
      )}

      {enabled && (
        <SettingsSubSection title="Your Sync Key">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input readOnly value={syncKey} />
              <Button variant="secondary" onClick={onCopy} disabled={!hasKey}>
                Copy
              </Button>
              <Button variant="destructive" onClick={onDisable}>
                Disable Sync
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Keep this key private. Anyone with this key can read and update your synced data.
            </p>
          </div>
        </SettingsSubSection>
      )}
    </SettingsSection>
  );
}