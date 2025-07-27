import { useMemo } from "react";
import { TOOLS } from "@/sdk/tools";

export function useToolRegistry() {
  const tools = useMemo(() => {
    return Object.values(TOOLS);
  }, []);

  return tools;
}
