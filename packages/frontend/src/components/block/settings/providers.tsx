import {
  SettingsSection,
  SettingsSubSection,
} from "@/components/layout/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetCloseIcon,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useApiKey, useModels } from "@/lib/storage-hooks";
import type { IModelInfo } from "@/sdk/shared";
import { useRef, useState } from "react";
import Anthropic from "~icons/ai-provider/anthropic";
import LucideSettings from "~icons/lucide/settings";
import LucideSave from "~icons/lucide/save";
import LucideTrash from "~icons/lucide/trash";
import LucideX from "~icons/lucide/x";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ModelConfigForm } from "@/components/block/settings/model-config";
import { SystemPromptSection } from "@/components/block/settings/system-prompt";
import OpenAI from "~icons/ai-provider/openai";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";

function ModelItem({
  model,
  onDisableToggle,
  onDelete,
}: {
  model: IModelInfo;
  onDisableToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-row justify-between rounded-md h-10 items-center px-2">
      <div className="flex flex-row gap-2 w-full items-center">
        {model.provider === "anthropic" && <Anthropic className="h-6 w-6" />}
        {model.provider === "openai" && (
          <OpenAI className="h-6 w-6 fill-black dark:fill-white" />
        )}
        <p className="text-sm">{model.displayName}</p>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="size-8">
              <LucideSettings />
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto pb-4">
            <SheetHeader className="sticky top-0 bg-background z-10">
              <SheetTitle>Model Settings</SheetTitle>
              <SheetDescription>
                Configure settings for model {model.displayName}.
              </SheetDescription>
              <SheetCloseIcon />
            </SheetHeader>
            <ModelConfigForm provider={model.provider} modelId={model.id} />
            <div className="flex flex-col gap-2 px-4 pt-6">
              <h3 className="text-sm font-medium">Actions</h3>
              <div className="flex flex-row gap-2 w-full">
                <Button
                  variant={model.disabled ? "outline" : "default"}
                  onClick={() => onDisableToggle()}
                  className="flex-1"
                >
                  {model.disabled ? "Enable" : "Disable"} model
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="shrink-0"
                    >
                      <LucideTrash />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete model</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this model?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        <LucideX />
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDelete}
                        variant="destructive"
                      >
                        <LucideTrash />
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function ModelSection() {
  const [models, setModels] = useModels();

  return (
    <SettingsSubSection title="Models">
      <ScrollArea className="flex flex-col border pr-2 h-50 rounded-md">
        <ScrollAreaViewport>
          {models.length > 0 ? (
            models.map((model) => (
              <div key={model.id}>
                <ModelItem
                  model={model}
                  onDisableToggle={() => {
                    setModels((p) => {
                      const newModels = [...p];
                      const index = newModels.findIndex(
                        (m) => m.id === model.id
                      );
                      newModels[index] = {
                        ...model,
                        disabled: !model.disabled,
                      };
                      return newModels;
                    });
                  }}
                  onDelete={() => {
                    setModels((p) => {
                      const newModels = [...p];
                      const index = newModels.findIndex(
                        (m) => m.id === model.id
                      );
                      newModels.splice(index, 1);
                      return newModels;
                    });
                  }}
                />
                <Separator />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground w-full h-full text-center content-center">
              No models available.
            </p>
          )}
        </ScrollAreaViewport>
      </ScrollArea>
    </SettingsSubSection>
  );
}

function ProviderProvider({
  provider,
  initialKey,
  onKeySave,
}: {
  provider: string;
  initialKey: string | null;
  onKeySave: (newKey: string) => void;
}) {
  const [key, setKey] = useState<string>(initialKey ?? "");
  const saveRef = useRef<HTMLButtonElement>(null);

  return (
    <div key={provider} className="border flex flex-col gap-2 rounded-md p-2">
      <div className="space-x-1">
        {provider === "anthropic" && (
          <Anthropic className="h-4 w-4 inline-block" />
        )}
        {provider === "openai" && (
          <OpenAI className="h-4 w-4 inline-block fill-black dark:fill-white" />
        )}
        <span className="text-sm font-medium">
          {provider[0].toUpperCase() + provider.slice(1)}
        </span>
      </div>
      <div className="flex flex-row justify-between items-center gap-2">
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              saveRef.current?.click();
            }
          }}
        />
        <Button ref={saveRef} onClick={() => onKeySave(key)}>
          <LucideSave />
          Save
        </Button>
      </div>
    </div>
  );
}

function ProviderSection() {
  const [apiKey, setApiKey] = useApiKey();

  return (
    <SettingsSubSection title="Providers">
      {Object.entries(apiKey).map(([provider, key]) => (
        <ProviderProvider
          key={provider}
          provider={provider}
          initialKey={key}
          onKeySave={(newKey) => {
            setApiKey((p) => ({
              ...p,
              [provider]: newKey,
            }));
          }}
        />
      ))}
    </SettingsSubSection>
  );
}

export function Providers() {
  return (
    <SettingsSection
      id={"settings-providers"}
      title="Providers"
      description="Configure your AI model providers."
    >
      <ModelSection />
      <ProviderSection />
      <SystemPromptSection />
    </SettingsSection>
  );
}
