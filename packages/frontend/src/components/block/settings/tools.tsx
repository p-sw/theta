import {
  SettingsSection,
  SettingsSubSection,
} from "@/components/layout/settings";
import { Button } from "@/components/ui/button";
import LucideSettings from "~icons/lucide/settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetCloseIcon,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useProviderToolEnabled,
  useToolProvidersMeta,
  useTools,
} from "@/lib/tools";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Fragment, useId, type ComponentProps } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TOOL_PROVIDER_SEPARATOR } from "@/lib/const";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { IToolProviderMeta } from "@/sdk/shared";
import { ToolProviderConfigForm } from "@/components/block/settings/tool-provider-config";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function ToolItems({
  providerId,
  disabled,
  isEnabled,
  toggleEnabled,
  isWhitelisted,
  toggleWhitelisted,
}: {
  providerId: string;
  disabled: boolean;
  isEnabled: (providerId: string, toolId: string) => boolean;
  toggleEnabled: (providerId: string, toolId: string) => void;
  isWhitelisted: (providerId: string, toolId: string) => boolean;
  toggleWhitelisted: (providerId: string, toolId: string) => void;
}) {
  const tools = useTools(providerId);
  const id = useId();

  return (
    <>
      <Accordion type="multiple" defaultValue={["functions"]}>
        <AccordionItem value="functions">
          <AccordionTrigger>
            <p>
              <span className="text-sm font-semibold block">
                Enable Functions
              </span>
              <span className="text-xs text-muted-foreground block">
                Enable functions to allow them to be used by AI.
              </span>
            </p>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2">
            {tools.map((tool) => (
              <div key={tool.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-provider-${providerId}-tool-${tool.id}-enabled`}
                  checked={isEnabled(
                    providerId,
                    tool.id.split(TOOL_PROVIDER_SEPARATOR)[1]
                  )}
                  onCheckedChange={() =>
                    toggleEnabled(
                      providerId,
                      tool.id.split(TOOL_PROVIDER_SEPARATOR)[1]
                    )
                  }
                  disabled={disabled}
                />
                <Label
                  htmlFor={`${id}-provider-${providerId}-tool-${tool.id}-enabled`}
                >
                  {tool.displayName}
                </Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="whitelist">
          <AccordionTrigger>
            <p>
              <span className="text-sm font-semibold block">Whitelist</span>
              <span className="text-xs text-muted-foreground block">
                Whitelist tools to allow them to be used by AI without user
                confirmation.
              </span>
            </p>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2">
            {tools.map((tool) => {
              const toolId = tool.id.split(TOOL_PROVIDER_SEPARATOR)[1];
              const enabled = isEnabled(providerId, toolId);
              const whitelisted = isWhitelisted(providerId, toolId);

              return (
                <div key={tool.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`${id}-provider-${providerId}-tool-${tool.id}-whitelisted`}
                    checked={whitelisted}
                    onCheckedChange={() =>
                      toggleWhitelisted(providerId, toolId)
                    }
                    disabled={disabled || !enabled}
                  />
                  <Label
                    htmlFor={`${id}-provider-${providerId}-tool-${tool.id}-whitelisted`}
                    className={!enabled ? "text-muted-foreground" : ""}
                  >
                    {tool.displayName}
                    {!enabled && (
                      <span className="text-xs ml-2">(Enable tool first)</span>
                    )}
                  </Label>
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}

function ToolProviderConfig({ provider }: { provider: IToolProviderMeta }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <LucideSettings />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Provider Configuration</SheetTitle>
          <SheetDescription>
            Configure the provider settings for {provider.displayName}.
          </SheetDescription>
          <SheetCloseIcon />
        </SheetHeader>
        <ToolProviderConfigForm provider={provider} />
      </SheetContent>
    </Sheet>
  );
}

export function ToolsSection() {
  const {
    isProviderEnabled,
    isToolEnabled,
    isToolWhitelisted,
    toggleProviderEnabled,
    toggleToolEnabled,
    toggleToolWhitelisted,
  } = useProviderToolEnabled();
  const providers = useToolProvidersMeta();

  const id = useId();

  return (
    <SettingsSubSection title="Tools">
      {providers.map((provider) => {
        const TooltipTriggerDisabled = provider.available
          ? (props: ComponentProps<typeof TooltipTrigger>) => (
              <Fragment {...props} />
            )
          : (props: ComponentProps<typeof TooltipTrigger>) => (
              <TooltipTrigger asChild {...props} />
            );

        return (
          <Card key={provider.id}>
            <CardHeader>
              <CardTitle>{provider.displayName}</CardTitle>
              <CardDescription>{provider.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ToolItems
                providerId={provider.id}
                disabled={
                  !provider.available || !isProviderEnabled(provider.id)
                }
                isEnabled={isToolEnabled}
                toggleEnabled={toggleToolEnabled}
                isWhitelisted={isToolWhitelisted}
                toggleWhitelisted={toggleToolWhitelisted}
              />
            </CardContent>
            <CardFooter className="justify-between gap-4">
              <Tooltip>
                <TooltipTriggerDisabled>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`${id}-provider-${provider.id}-enabled`}
                      checked={isProviderEnabled(provider.id)}
                      onCheckedChange={() => toggleProviderEnabled(provider.id)}
                      disabled={!provider.available}
                    />
                    <Label
                      htmlFor={`${id}-provider-${provider.id}-enabled-mobile`}
                    >
                      Enabled
                    </Label>
                  </div>
                </TooltipTriggerDisabled>
                <TooltipContent>
                  Cannot setup provider. Please check your provider settings.
                </TooltipContent>
              </Tooltip>
              <ToolProviderConfig provider={provider} />
            </CardFooter>
          </Card>
        );
      })}
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
