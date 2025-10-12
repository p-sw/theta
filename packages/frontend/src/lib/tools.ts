import {
  TOOL_ENABLED_KEY,
  TOOL_WHITELISTED_KEY,
  TOOL_PROVIDER_AVAILABILITY_KEY,
  TOOL_PROVIDER_CONFIG_ANY_KEY,
  TOOL_PROVIDER_CONFIG_KEY,
  TOOL_PROVIDER_ENABLED_KEY,
  TOOL_PROVIDER_SEPARATOR,
} from "@/lib/const";
import { dispatchEvent, useStorage } from "@/lib/utils";
import type { IToolMetaJson, IToolProviderMeta, IConfigSchema } from "@/sdk/shared";
import type { ZodSchema } from "zod";
let _toolRegistryPromise: Promise<typeof import("@/sdk/tools")> | null = null;
function getToolRegistry() {
  if (!_toolRegistryPromise) {
    _toolRegistryPromise = import("@/sdk/tools");
  }
  return _toolRegistryPromise;
}
import { useCallback, useEffect, useMemo, useState } from "react";

export function useToolProvidersMeta() {
  const [providers, setProviders] = useState<
    (IToolProviderMeta & { available: boolean })[]
  >([]);

  const updateProviders = useCallback(() => {
    getToolRegistry().then(({ toolRegistry }) => {
      setProviders(
        toolRegistry.getProviders().map((provider) => ({
          ...provider,
          available: toolRegistry.isProviderAvailable(provider.id),
        }))
      );
    });
  }, []);

  useEffect(() => {
    updateProviders();

    window.addEventListener(TOOL_PROVIDER_AVAILABILITY_KEY, updateProviders);
    return () => {
      window.removeEventListener(
        TOOL_PROVIDER_AVAILABILITY_KEY,
        updateProviders
      );
    };
  }, [updateProviders]);

  return providers;
}

type Param<T> = T extends (...args: (infer U)[]) => unknown ? U : never;

export function useToolProvidersConfig(providerId: string) {
  const [providerConfig, setProviderConfig] = useState<
    [object, Record<string, IConfigSchema>, ZodSchema<object>] | null
  >(null);

  const [config, setConfig] = useStorage(
    TOOL_PROVIDER_CONFIG_KEY(providerId),
    providerConfig?.[0] ?? {}
  );

  useEffect(() => {
    let mounted = true;
    getToolRegistry().then(({ toolRegistry }) => {
      if (!mounted) return;
      setProviderConfig(toolRegistry.getProviderConfig(providerId));
    });
    return () => {
      mounted = false;
    };
  }, [providerId]);

  return [
    config,
    (data: Param<typeof setConfig>) => {
      setConfig(data);
      dispatchEvent(TOOL_PROVIDER_CONFIG_ANY_KEY, {});
      dispatchEvent(TOOL_PROVIDER_CONFIG_KEY(providerId), {});
    },
    providerConfig?.[1] as Record<string, IConfigSchema>,
    providerConfig?.[2] as ZodSchema<object>,
  ] as const;
}

export function useTools(providerId: string) {
  const [tools, setTools] = useState<IToolMetaJson[]>([]);

  useEffect(() => {
    getToolRegistry().then(({ toolRegistry }) => {
      setTools(toolRegistry.getAll(providerId));
    });
  }, [providerId]);

  return tools;
}

export function useProviderToolEnabled() {
  const [enabledProviders, setEnabledProviders] = useStorage<string[]>(
    TOOL_PROVIDER_ENABLED_KEY,
    []
  );
  const [enabledTools, setEnabledTools] = useStorage<string[]>(
    TOOL_ENABLED_KEY,
    []
  );
  const [whitelistedTools, setWhitelistedTools] = useStorage<string[]>(
    TOOL_WHITELISTED_KEY,
    []
  );

  const isProviderEnabled = useCallback(
    (providerId: string) => {
      return enabledProviders.includes(providerId);
    },
    [enabledProviders]
  );

  const isToolEnabled = useCallback(
    (providerId: string, toolId: string) => {
      return enabledTools.includes(
        providerId + TOOL_PROVIDER_SEPARATOR + toolId
      );
    },
    [enabledTools]
  );

  const isToolWhitelisted = useCallback(
    (providerId: string, toolId: string) => {
      return whitelistedTools.includes(
        providerId + TOOL_PROVIDER_SEPARATOR + toolId
      );
    },
    [whitelistedTools]
  );

  const toggleProviderEnabled = useCallback(
    (providerId: string) => {
      setEnabledProviders((prev) => {
        if (prev.includes(providerId)) {
          return prev.filter((id) => id !== providerId);
        } else {
          return [...prev, providerId];
        }
      });
    },
    [setEnabledProviders]
  );

  const toggleToolEnabled = useCallback(
    (providerId: string, toolId: string) => {
      setEnabledTools((prev) => {
        if (prev.includes(providerId + TOOL_PROVIDER_SEPARATOR + toolId)) {
          return prev.filter(
            (id) => id !== providerId + TOOL_PROVIDER_SEPARATOR + toolId
          );
        } else {
          return [...prev, providerId + TOOL_PROVIDER_SEPARATOR + toolId];
        }
      });
    },
    [setEnabledTools]
  );

  const toggleToolWhitelisted = useCallback(
    (providerId: string, toolId: string) => {
      setWhitelistedTools((prev) => {
        const toolKey = providerId + TOOL_PROVIDER_SEPARATOR + toolId;
        if (prev.includes(toolKey)) {
          return prev.filter((id) => id !== toolKey);
        } else {
          return [...prev, toolKey];
        }
      });
    },
    [setWhitelistedTools]
  );

  return {
    isProviderEnabled,
    isToolEnabled,
    isToolWhitelisted,
    toggleProviderEnabled,
    toggleToolEnabled,
    toggleToolWhitelisted,
  };
}

export function useIsToolWhitelisted(providerIdToolId: string): boolean {
  const [whitelistedTools] = useStorage<string[]>(TOOL_WHITELISTED_KEY, []);

  return whitelistedTools.includes(providerIdToolId);
}

export function useToolInformation(providerIdToolId: string): {
  provider: IToolProviderMeta | undefined;
  tool: IToolMetaJson | undefined;
} {
  const [providerId, toolId] = useMemo(
    () => providerIdToolId.split(TOOL_PROVIDER_SEPARATOR),
    [providerIdToolId]
  );

  const [provider, setProvider] = useState<IToolProviderMeta | undefined>();
  const [tool, setTool] = useState<IToolMetaJson | undefined>();
  useEffect(() => {
    let mounted = true;
    getToolRegistry().then(({ toolRegistry }) => {
      if (!mounted) return;
      setProvider(toolRegistry.getProviders().find((p) => p.id === providerId));
      setTool(toolRegistry.get(providerId, toolId));
    });
    return () => {
      mounted = false;
    };
  }, [providerId, toolId]);

  return {
    provider,
    tool,
  };
}
