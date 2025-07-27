import {
  SettingsSection,
  SettingsSubSection,
} from "@/components/layout/settings";
import { type ITool, type IToolConfig } from "@/sdk/shared";
import { useToolRegistry } from "@/sdk/tools/hooks";
import LucideWrench from "~icons/lucide/wrench";
import { Button } from "@/components/ui/button";
import LucideSettings from "~icons/lucide/settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TOOL_CONFIG_KEY } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import {
  Sheet,
  SheetCloseIcon,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToolConfigForm } from "@/components/block/settings/tool-config";
import type { ToolId } from "@/sdk/tools";

export function ToolItem({ tool }: { tool: ITool<unknown> }) {
  const [config, setConfig] = useStorage<IToolConfig<unknown>>(
    TOOL_CONFIG_KEY(tool.id),
    {
      disabled: false,
      config: tool.getDefaultConfig(),
    }
  );

  return (
    <div className="border flex flex-row gap-2 rounded-md p-2">
      <div className="space-x-1 flex-1 content-center">
        <LucideWrench className="inline-block" />
        <span className="text-sm font-medium">{tool.displayName}</span>
      </div>
      <div className="flex flex-row gap-2">
        <div className="flex flex-row gap-2 items-center">
          <Switch
            id={`settings-functions-tool-${tool.id}-enabled`}
            checked={!config.disabled}
            onCheckedChange={(checked) => {
              setConfig({
                ...config,
                disabled: !checked,
              });
            }}
          />
          <Label htmlFor={`settings-functions-tool-${tool.id}-enabled`}>
            Enabled
          </Label>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="p-0">
              <LucideSettings className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto pb-4">
            <SheetHeader className="sticky top-0 bg-background z-10">
              <SheetTitle>Tool Settings</SheetTitle>
              <SheetDescription>
                Configure settings for tool {tool.displayName}.
              </SheetDescription>
              <SheetCloseIcon />
            </SheetHeader>
            <ToolConfigForm toolId={tool.id as ToolId} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export function ToolsSection() {
  const tools = useToolRegistry();

  return (
    <SettingsSubSection title="Tools">
      {tools.map((tool) => (
        <ToolItem key={tool.id} tool={tool} />
      ))}
    </SettingsSubSection>
  );
}

export function Tools() {
  return (
    <SettingsSection
      id="settings-functions"
      title="Tools & MCPs"
      description="Let your AI control your world."
    >
      <ToolsSection />
    </SettingsSection>
  );
}
