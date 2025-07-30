import {
  TOOL_ENABLED_KEY,
  TOOL_PROVIDER_AVAILABILITY_KEY,
  TOOL_PROVIDER_CONFIG_ANY_KEY,
  TOOL_PROVIDER_CONFIG_KEY,
  TOOL_PROVIDER_ENABLED_KEY,
  TOOL_PROVIDER_SEPARATOR,
  TOOL_WHITELIST_KEY,
} from "@/lib/const";
import { dispatchEvent, useStorage } from "@/lib/utils";
import type { IToolMetaJson, IToolProviderMeta } from "@/sdk/shared";
import { toolRegistry } from "@/sdk/tools";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useToolProvidersMeta() {
  const [providers, setProviders] = useState<
    (IToolProviderMeta & { available: boolean })[]
  >([]);

  const updateProviders = useCallback(() => {
    setProviders(
      toolRegistry.getProviders().map((provider) => ({
        ...provider,
        available: toolRegistry.isProviderAvailable(provider.id),
      }))
    );
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
  const [providerConfig, setProviderConfig] = useState(
    toolRegistry.getProviderConfig(providerId)
  );

  const [config, setConfig] = useStorage(
    TOOL_PROVIDER_CONFIG_KEY(providerId),
    providerConfig[0]
  );

  useEffect(() => {
    setProviderConfig(toolRegistry.getProviderConfig(providerId));
  }, [providerId]);

  return [
    config,
    (data: Param<typeof setConfig>) => {
      setConfig(data);
      dispatchEvent(TOOL_PROVIDER_CONFIG_ANY_KEY, {});
      dispatchEvent(TOOL_PROVIDER_CONFIG_KEY(providerId), {});
    },
    providerConfig[1],
    providerConfig[2],
  ] as const;
}

export function useTools(providerId: string) {
  const [tools, setTools] = useState<IToolMetaJson[]>([]);

  useEffect(() => {
    setTools(toolRegistry.getAll(providerId));
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

  return {
    isProviderEnabled,
    isToolEnabled,
    toggleProviderEnabled,
    toggleToolEnabled,
  };
}

export function useToolInformation(providerIdToolId: string): {
  provider: IToolProviderMeta | undefined;
  tool: IToolMetaJson | undefined;
} {
  const [providerId, toolId] = useMemo(
    () => providerIdToolId.split(TOOL_PROVIDER_SEPARATOR),
    [providerIdToolId]
  );

  const provider = useMemo(
    () => toolRegistry.getProviders().find((p) => p.id === providerId),
    [providerId]
  );
  const tool = useMemo(
    () => toolRegistry.get(providerId, toolId),
    [providerId, toolId]
  );

  return {
    provider,
    tool,
  };
}



// Whitelist management functions
export const useWhitelistedTools = () => {
  const whitelistedTools = useStorage<string[]>(TOOL_WHITELIST_KEY, []);
  return whitelistedTools;
};

export const useIsToolWhitelisted = (providerId: string, toolId: string) => {
  const whitelistedTools = useWhitelistedTools();
  return whitelistedTools.includes(
    providerId + TOOL_PROVIDER_SEPARATOR + toolId
  );
};

export const useToggleToolWhitelist = () => {
  return useCallback((providerId: string, toolId: string) => {
    const whitelistString = localStorage.getItem(TOOL_WHITELIST_KEY);
    let whitelistedTools: string[] = [];
    
    if (whitelistString) {
      try {
        whitelistedTools = JSON.parse(whitelistString);
      } catch {
        whitelistedTools = [];
      }
    }

    const toolKey = providerId + TOOL_PROVIDER_SEPARATOR + toolId;
    const isWhitelisted = whitelistedTools.includes(toolKey);

    if (isWhitelisted) {
      whitelistedTools = whitelistedTools.filter((id) => id !== toolKey);
    } else {
      whitelistedTools.push(toolKey);
    }

    localStorage.setItem(TOOL_WHITELIST_KEY, JSON.stringify(whitelistedTools));
    dispatchEvent(TOOL_WHITELIST_KEY, {});
  }, []);
};

export const isToolWhitelisted = (providerId: string, toolId: string) => {
  const whitelistString = localStorage.getItem(TOOL_WHITELIST_KEY);
  if (!whitelistString) return false;
  
  try {
    const whitelistedTools = JSON.parse(whitelistString);
    return whitelistedTools.includes(
      providerId + TOOL_PROVIDER_SEPARATOR + toolId
    );
  } catch {
    return false;
  }
};
