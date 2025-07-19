import {
  SettingsSection,
  SettingsSubSection,
} from "@/components/layout/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { API_KEY, MODELS, type IApiKey } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import { AiSdk } from "@/sdk";
import type { IModelInfo } from "@/sdk/shared";
import { useEffect, useRef, useState, useTransition } from "react";
import Anthropic from "~icons/ai-provider/anthropic";
import LucideRotateCw from "~icons/lucide/rotate-cw";
import LucideSave from "~icons/lucide/save";

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
}: {
  model: IModelInfo;
  onDisableToggle: (model: IModelInfo) => void;
}) {
  return (
    <div className="flex flex-row justify-between rounded-md h-10 items-center px-2">
      <div className="flex flex-row gap-2 w-full items-center">
        <Anthropic className="h-6 w-6" />
        <p className="text-sm">{model.displayName}</p>
      </div>
      <div className="flex flex-row gap-2 items-center">
        <Switch
          checked={!model.disabled}
          onCheckedChange={() => onDisableToggle(model)}
        />
      </div>
    </div>
  );
}

function ModelSection() {
  const [refetch, setRefetch] = useState(false);
  const [apiKey] = useStorage<IApiKey>(API_KEY, {
    anthropic: null,
  });
  const [models, setModels] = useStorage<IModelInfo[]>(MODELS, []);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (Object.values(apiKey).every((v) => v === null)) return;
    if (models.length > 0 && !refetch) return;
    const fetchModels = async () => {
      const models = await AiSdk.getAvailableModels();
      setModels(models);
    };
    startTransition(fetchModels);
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
                onDisableToggle={(model) => {
                  setModels((p) => {
                    const index = p.findIndex((m) => m.id === model.id);
                    if (index === -1) {
                      console.error(
                        "While updating model, model not found in the list"
                      );
                      return p;
                    }
                    const newModels = [...p];
                    newModels[index] = {
                      ...model,
                      disabled: !model.disabled,
                    };
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
  initialKey: string;
  onKeySave: (newKey: string) => void;
}) {
  const [key, setKey] = useState(initialKey);
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
  const [apiKey, setApiKey] = useStorage<IApiKey>(API_KEY, {
    anthropic: null,
  });

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
    </SettingsSection>
  );
}
