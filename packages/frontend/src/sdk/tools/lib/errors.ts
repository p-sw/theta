export class ToolRegistryError extends Error {
  constructor(message: string) {
    super(`[ToolRegistryError] ${message}`);
    this.name = "ToolRegistryError";
  }
}

export class ToolParameterError extends Error {
  constructor(message: string) {
    super(`[ToolParameterError] ${message}`);
    this.name = "ToolParameterError";
  }
}

export class ToolExecutionError extends Error {
  constructor(message: string) {
    super(`[ToolExecutionError] ${message}`);
    this.name = "ToolExecutionError";
  }
}
