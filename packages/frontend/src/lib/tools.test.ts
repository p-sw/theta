import { describe, test, expect, beforeEach } from "vitest";
import { isToolWhitelisted } from "./tools";
import { TOOL_WHITELIST_KEY, TOOL_PROVIDER_SEPARATOR } from "./const";

describe("Tool Whitelist", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  test("should return false for non-whitelisted tool", () => {
    expect(isToolWhitelisted("provider1", "tool1")).toBe(false);
  });

  test("should return true for whitelisted tool", () => {
    const whitelist = [
      `provider1${TOOL_PROVIDER_SEPARATOR}tool1`, 
      `provider2${TOOL_PROVIDER_SEPARATOR}tool2`
    ];
    localStorage.setItem(TOOL_WHITELIST_KEY, JSON.stringify(whitelist));
    
    expect(isToolWhitelisted("provider1", "tool1")).toBe(true);
    expect(isToolWhitelisted("provider2", "tool2")).toBe(true);
    expect(isToolWhitelisted("provider3", "tool3")).toBe(false);
  });

  test("should handle invalid JSON in localStorage", () => {
    localStorage.setItem(TOOL_WHITELIST_KEY, "invalid json");
    expect(isToolWhitelisted("provider1", "tool1")).toBe(false);
  });

  test("should handle empty whitelist", () => {
    localStorage.setItem(TOOL_WHITELIST_KEY, JSON.stringify([]));
    expect(isToolWhitelisted("provider1", "tool1")).toBe(false);
  });
});