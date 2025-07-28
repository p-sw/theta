/**
 * Throw before/after tool execution
 */
export class ToolRegistryError extends Error {
  constructor(message: string) {
    super(`[ToolRegistryError] ${message}`);
    this.name = "ToolRegistryError";
  }
}

/**
 * Throw on parameter validation time
 */
export class ToolParameterError extends Error {
  constructor(message: string) {
    super(`[ToolParameterError] ${message}`);
    this.name = "ToolParameterError";
  }
}

/**
 * Throw on tool execution time
 */
export class ToolExecutionError extends Error {
  constructor(message: string) {
    super(`[ToolExecutionError] ${message}`);
    this.name = "ToolExecutionError";
  }
}
