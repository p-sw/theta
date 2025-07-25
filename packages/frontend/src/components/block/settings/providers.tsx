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
import { Skeleton } from "@/components/ui/skeleton";
import { useApiKey, useModels } from "@/lib/storage-hooks";
import { AiSdk } from "@/sdk";
import type { IModelInfo } from "@/sdk/shared";
import { useEffect, useRef, useState, useTransition } from "react";
import Anthropic from "~icons/ai-provider/anthropic";
import LucideSettings from "~icons/lucide/settings";
import LucideRotateCw from "~icons/lucide/rotate-cw";
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

function ModelItemSkeleton() {
  return (
    <div className="flex flex-row justify-between rounded-md h-10 items-center px-2">
      <div className="flex flex-row gap-2 w-full items-center">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-50" />
      </div>
    </div>
  );
}

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
        <Anthropic className="h-6 w-6" />
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
  const [refetch, setRefetch] = useState(false);
  const [apiKey] = useApiKey();
  const [models, setModels] = useModels();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (Object.values(apiKey).every((v) => v === null)) return;
    if (models.length > 0 && !refetch) return;
    setRefetch(false);
    startTransition(async () => {
      const models = await AiSdk.getAvailableModels();
      setModels((p) => {
        // only add missing models, ignore existing models
        const newModels = [...p];
        models.forEach((model) => {
          const index = newModels.findIndex((m) => m.id === model.id);
          if (index === -1) {
            newModels.push(model);
          }
        });
        return newModels;
      });
    });
  }, [models, refetch, setModels, apiKey]);

  return (
    <SettingsSubSection
      title="Models"
      subsectionActions={
        <Button
          onClick={() => setRefetch(true)}
          disabled={
            isPending ||
            refetch ||
            Object.values(apiKey).every((v) => v === null)
          }
        >
          <LucideRotateCw />
          Refetch
        </Button>
      }
    >
      <div className="flex flex-col border overflow-y-scroll h-50 rounded-md">
        {isPending ? (
          <>
            <ModelItemSkeleton />
            <Separator />
            <ModelItemSkeleton />
            <Separator />
            <ModelItemSkeleton />
            <Separator />
            <ModelItemSkeleton />
            <Separator />
            <ModelItemSkeleton />
          </>
        ) : models.length > 0 ? (
          models.map((model) => (
            <div key={model.id}>
              <ModelItem
                model={model}
                onDisableToggle={() => {
                  setModels((p) => {
                    const newModels = [...p];
                    const index = newModels.findIndex((m) => m.id === model.id);
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
                    const index = newModels.findIndex((m) => m.id === model.id);
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
      </div>
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
        <Anthropic className="h-4 w-4 inline-block" />
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
