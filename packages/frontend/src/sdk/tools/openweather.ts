import type { ITool } from "@/sdk/shared";
import { z } from "zod";
import { ToolParameterError, ToolExecutionError } from "./lib/errors";
import { getToolConfig } from "./lib/utils";

export interface IOpenWeatherConfig {
  apiKey: string;
}

export const openWeatherTool: ITool<IOpenWeatherConfig> = {
  id: "openweather",
  displayName: "OpenWeather API",
  description: "Get current weather information for any city",
  schema: {
    name: "get_weather",
    description: "Get current weather information for a specified city",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "The city name to get weather for",
        },
        units: {
          type: "string",
          enum: ["metric", "imperial", "kelvin"],
          description:
            "Temperature units (metric=Celsius, imperial=Fahrenheit, kelvin=Kelvin)",
          default: "metric",
        },
      },
      required: ["city"],
    },
  },
  schemaZod: z.object({
    city: z.string(),
    units: z.enum(["metric", "imperial", "kelvin"]).optional(),
  }),
  async ensureParameters(parameters: { city: string; units?: string }) {
    const result = this.schemaZod.safeParse(parameters);
    if (!result.success) {
      throw new ToolParameterError(
        `Invalid parameters: ${result.error.message}`
      );
    }
  },
  async execute(parameters: { city: string; units?: string }) {
    const config = getToolConfig<IOpenWeatherConfig>(
      "openweather",
      this.getDefaultConfig(),
      this.getConfigSchema()[1]
    );
    const apiKey = config.config.apiKey;

    if (!apiKey) {
      throw new ToolExecutionError("OpenWeather API key not configured");
    }

    const units = parameters.units || "metric";
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      parameters.city
    )}&appid=${apiKey}&units=${units}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new ToolExecutionError(`Weather API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      city: data.name,
      country: data.sys.country,
      temperature: data.main.temp,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      units,
    };
  },
  getDefaultConfig(): IOpenWeatherConfig {
    return {
      apiKey: "",
    };
  },
  getConfigSchema() {
    const schema = {
      apiKey: {
        type: "string" as const,
        displayName: "API Key",
        description: "OpenWeather API key from openweathermap.org",
      },
    };

    const zodSchema = z.object({
      apiKey: z.string(),
    });

    return [schema, zodSchema] as const;
  },
};
