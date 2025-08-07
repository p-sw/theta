import {
  type IConfigSchema,
  type IToolProvider,
  type ITool,
} from "@/sdk/shared";
import {
  ToolExecutionError,
  ToolParameterError,
  ToolRegistryError,
} from "@/sdk/tools/errors";
import type { IOpenWeatherConfig } from "@/sdk/tools/providers/openweather.types";
import z from "zod";

export const Country = [
  "AF",
  "AX",
  "AL",
  "DZ",
  "AS",
  "AD",
  "AO",
  "AI",
  "AQ",
  "AG",
  "AR",
  "AM",
  "AW",
  "AU",
  "AT",
  "AZ",
  "BS",
  "BH",
  "BD",
  "BB",
  "BY",
  "BE",
  "BZ",
  "BJ",
  "BM",
  "BT",
  "BO",
  "BQ",
  "BA",
  "BW",
  "BV",
  "BR",
  "IO",
  "BN",
  "BG",
  "BF",
  "BI",
  "KH",
  "CM",
  "CA",
  "CV",
  "KY",
  "CF",
  "TD",
  "CL",
  "CN",
  "CX",
  "CC",
  "CO",
  "KM",
  "CG",
  "CD",
  "CK",
  "CR",
  "CI",
  "HR",
  "CU",
  "CW",
  "CY",
  "CZ",
  "DK",
  "DJ",
  "DM",
  "DO",
  "EC",
  "EG",
  "SV",
  "GQ",
  "ER",
  "EE",
  "ET",
  "FK",
  "FO",
  "FJ",
  "FI",
  "FR",
  "GF",
  "PF",
  "TF",
  "GA",
  "GM",
  "GE",
  "DE",
  "GH",
  "GI",
  "GR",
  "GL",
  "GD",
  "GP",
  "GU",
  "GT",
  "GG",
  "GN",
  "GW",
  "GY",
  "HT",
  "HM",
  "VA",
  "HN",
  "HK",
  "HU",
  "IS",
  "IN",
  "ID",
  "IR",
  "IQ",
  "IE",
  "IM",
  "IL",
  "IT",
  "JM",
  "JP",
  "JE",
  "JO",
  "KZ",
  "KE",
  "KI",
  "KR",
  "KP",
  "KW",
  "KG",
  "LA",
  "LV",
  "LB",
  "LS",
  "LR",
  "LY",
  "LI",
  "LT",
  "LU",
  "MO",
  "MK",
  "MG",
  "MW",
  "MY",
  "MV",
  "ML",
  "MT",
  "MH",
  "MQ",
  "MR",
  "MU",
  "YT",
  "MX",
  "FM",
  "MD",
  "MC",
  "MN",
  "ME",
  "MS",
  "MA",
  "MZ",
  "MM",
  "NA",
  "NR",
  "NP",
  "NL",
  "NC",
  "NZ",
  "NI",
  "NE",
  "NG",
  "NU",
  "NF",
  "MP",
  "NO",
  "OM",
  "PK",
  "PW",
  "PS",
  "PA",
  "PG",
  "PY",
  "PE",
  "PH",
  "PN",
  "PL",
  "PT",
  "PR",
  "QA",
  "RE",
  "RO",
  "RU",
  "RW",
  "BL",
  "SH",
  "KN",
  "LC",
  "MF",
  "PM",
  "VC",
  "WS",
  "SM",
  "ST",
  "SA",
  "SN",
  "RS",
  "SC",
  "SL",
  "SG",
  "SX",
  "SK",
  "SI",
  "SB",
  "SO",
  "ZA",
  "GS",
  "SS",
  "ES",
  "LK",
  "SD",
  "SR",
  "SJ",
  "SZ",
  "SE",
  "CH",
  "SY",
  "TW",
  "TJ",
  "TZ",
  "TH",
  "TL",
  "TG",
  "TK",
  "TO",
  "TT",
  "TN",
  "TR",
  "TM",
  "TC",
  "TV",
  "UG",
  "UA",
  "AE",
  "GB",
  "US",
  "UM",
  "UY",
  "UZ",
  "VU",
  "VE",
  "VN",
  "VG",
  "VI",
  "WF",
  "EH",
  "YE",
  "ZM",
  "ZW",
] as const;

class OpenWeatherGeocoding {
  private API_BASE_URL = "https://api.openweathermap.org/geo/1.0";
  private config: IOpenWeatherConfig;

  constructor(config: IOpenWeatherConfig) {
    this.config = config;
  }

  setup(config: IOpenWeatherConfig) {
    this.config = config;
  }

  async coordinatesByLocationName({
    cityName,
    countryCode,
    stateCode,
  }: {
    cityName: string;
    countryCode: string;
    stateCode?: string;
  }): Promise<string> {
    const url = new URL(`${this.API_BASE_URL}/direct`);
    url.searchParams.set(
      "q",
      `${cityName},${countryCode === "US" ? stateCode : countryCode}`
    );
    url.searchParams.set("limit", "2");
    url.searchParams.set("appid", this.config.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ToolExecutionError(
        `${response.status} ${response.statusText}: ${await response.text()}`
      );
    }

    const data = await response.json();
    return JSON.stringify(
      data.map(
        (item: {
          name: string;
          lat: number;
          lon: number;
          country: string;
          state?: string;
        }) => ({
          name: item.name,
          lat: item.lat,
          lon: item.lon,
          country: item.country,
          ...(item.state ? { state: item.state } : {}),
        })
      )
    );
  }

  async coordinatesByZipPostCode({
    zip,
    countryCode,
  }: {
    zip: string;
    countryCode: string;
  }): Promise<string> {
    const url = new URL(`${this.API_BASE_URL}/zip`);
    url.searchParams.set("zip", `${zip},${countryCode}`);
    url.searchParams.set("limit", "1");
    url.searchParams.set("appid", this.config.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ToolExecutionError(
        `${response.status} ${response.statusText}: ${await response.text()}`
      );
    }

    return await response.text();
  }
}

class OpenWeatherOneWeather {
  private API_BASE_URL = "https://api.openweathermap.org/data/3.0";
  private config: IOpenWeatherConfig;

  constructor(config: IOpenWeatherConfig) {
    this.config = config;
  }

  setup(config: IOpenWeatherConfig) {
    this.config = config;
  }

  async currentAndForecastsWeather({
    lat,
    lon,
    include,
  }: {
    lat: number;
    lon: number;
    include: ("current" | "minutely" | "hourly" | "daily" | "alerts")[]; // to save token and context window
  }): Promise<string> {
    const exclude = (
      ["current", "minutely", "hourly", "daily", "alerts"] as const
    ).filter((item) => !include.includes(item));
    const url = new URL(`${this.API_BASE_URL}/onecall`);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lon", lon.toString());
    url.searchParams.set("exclude", exclude.join(","));
    url.searchParams.set("appid", this.config.apiKey);
    url.searchParams.set("units", this.config.units);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ToolExecutionError(
        `${response.status} ${response.statusText}: ${await response.text()}`
      );
    }

    return await response.text();
  }

  async timemachineWeather({
    lat,
    lon,
    dt,
  }: {
    lat: number;
    lon: number;
    dt: number;
  }): Promise<string> {
    const url = new URL(`${this.API_BASE_URL}/onecall/timemachine`);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lon", lon.toString());
    url.searchParams.set("dt", dt.toString());
    url.searchParams.set("appid", this.config.apiKey);
    url.searchParams.set("units", this.config.units);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ToolExecutionError(
        `${response.status} ${response.statusText}: ${await response.text()}`
      );
    }

    return await response.text();
  }

  async dailyAggragatedWeather({
    lat,
    lon,
    date,
  }: {
    lat: number;
    lon: number;
    date: string;
  }): Promise<string> {
    const url = new URL(`${this.API_BASE_URL}/onecall/day_summary`);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lon", lon.toString());
    url.searchParams.set("date", date);
    url.searchParams.set("appid", this.config.apiKey);
    url.searchParams.set("units", this.config.units);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ToolExecutionError(
        `${response.status} ${response.statusText}: ${await response.text()}`
      );
    }

    return await response.text();
  }

  async weatherOverview({
    lat,
    lon,
    date,
  }: {
    lat: number;
    lon: number;
    date?: `${number}-${number}-${number}`;
  }): Promise<string> {
    const url = new URL(`${this.API_BASE_URL}/weather`);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lon", lon.toString());
    url.searchParams.set("appid", this.config.apiKey);
    if (date) {
      url.searchParams.set("date", date);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ToolExecutionError(
        `${response.status} ${response.statusText}: ${await response.text()}`
      );
    }

    return await response.text();
  }
}

export class OpenWeatherProvider implements IToolProvider<IOpenWeatherConfig> {
  static id = "openweather";
  id = "openweather";
  displayName = "OpenWeather API";
  description = "Fetch weather data from OpenWeather API";

  private apiGroup: {
    geocoding?: OpenWeatherGeocoding;
    oneWeather?: OpenWeatherOneWeather;
  } = {};

  private configSchema: Record<keyof IOpenWeatherConfig, IConfigSchema> = {
    apiKey: {
      type: "string",
      displayName: "API Key",
      description: "OpenWeather API key from openweathermap.org",
    },
    units: {
      type: "enum",
      displayName: "Units",
      description: "Units of measurement",
      placeholder: "Select units",
      items: [
        {
          name: "Metric (°C, m/s)",
          value: "metric",
        },
        {
          name: "Imperial (°F, mph)",
          value: "imperial",
        },
        {
          name: "Standard (K, m/s)",
          value: "standard",
        },
      ],
    },
  };

  private configSchemaZod = z.object({
    apiKey: z.string().nonempty(),
    units: z.enum(["metric", "imperial", "standard"]).default("standard"),
  });

  setup(config: IOpenWeatherConfig) {
    try {
      this.configSchemaZod.parse(config);
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new ToolRegistryError(JSON.stringify(z.treeifyError(e)));
      }
      throw e;
    }
    if (!this.apiGroup.geocoding) {
      this.apiGroup.geocoding = new OpenWeatherGeocoding(config);
    } else {
      this.apiGroup.geocoding.setup(config);
    }
    if (!this.apiGroup.oneWeather) {
      this.apiGroup.oneWeather = new OpenWeatherOneWeather(config);
    } else {
      this.apiGroup.oneWeather.setup(config);
    }
  }

  getDefaultConfig(): IOpenWeatherConfig {
    return {
      apiKey: "",
      units: "standard",
    };
  }

  getConfigSchema(): [
    Record<keyof IOpenWeatherConfig, IConfigSchema>,
    z.ZodSchema<IOpenWeatherConfig>
  ] {
    return [this.configSchema, this.configSchemaZod];
  }

  private _tools: ITool[] = [];
  get tools(): ITool[] {
    if (this._tools.length === 0) {
      this._tools = [
        {
          id: "coordinates-by-location-name",
          displayName: "Get coordinates by location name",
          description: `You can get geographical coordinates (lat, lon) by using name of the location (city name or area name). There could be multiple locations with the same name.`,
          schema: z.object({
            cityName: z.string().nonempty().describe("Name of the city"),
            countryCode: z
              .enum(Country)
              .describe("Country code, use ISO 3166-1 codes"),
            stateCode: z
              .string()
              .optional()
              .describe("State code (only for the US)"),
          }),
          execute: async (params) => {
            if (!this.apiGroup.geocoding) {
              throw new ToolExecutionError(
                "Geocoding API is not initialized. Please setup the provider config first."
              );
            }
            return await this.apiGroup.geocoding.coordinatesByLocationName(
              params
            );
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) {
                throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              }
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
        // not adding zip/post code tool?
        {
          id: "current-and-forecasts-weather",
          displayName: "Current and forecasts Weather",
          description: `You can get the current weather, minute forecast for 1 hour, hourly forecast for 48 hours, daily forecast for 8 days and government weather alerts.
                    You should call geocode tool to get the coordinates of the location with the name of the city.`,
          schema: z.object({
            lat: z
              .number()
              .min(-90)
              .max(90)
              .describe(
                "Latitude. If you need the geocoder to automatic convert city names and zip-codes to geo coordinates and the other way around, use geocoding tool."
              ),
            lon: z
              .number()
              .min(-180)
              .max(180)
              .describe(
                "Longitude. If you need the geocoder to automatic convert city names and zip-codes to geo coordinates and the other way around, use geocoding tool."
              ),
            include: z
              .array(
                z.enum(["current", "minutely", "hourly", "daily", "alerts"])
              )
              .describe(
                "Include the weather data you want to get. You can get the current weather, minute forecast for 1 hour, hourly forecast for 48 hours, daily forecast for 8 days and government weather alerts."
              ),
          }),
          execute: async (params) => {
            if (!this.apiGroup.oneWeather) {
              throw new ToolExecutionError(
                "OneWeather API is not initialized. Please setup the provider config first."
              );
            }
            return await this.apiGroup.oneWeather.currentAndForecastsWeather(
              params
            );
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) {
                throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              }
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
        {
          id: "weather-data-for-timestamp",
          displayName: "Weather data for timestamp",
          description:
            "You can get the weather data for any timestamp from 1st January 1979 till 4 days ahead forecast.",
          schema: z.object({
            lat: z.number().min(-90).max(90).describe("Latitude"),
            lon: z.number().min(-180).max(180).describe("Longitude"),
            dt: z
              .number()
              .describe(
                "Timestamp (Unix time, UTC time zone), e.g. dt=1586468027. Data is available from January 1st, 1979 till 4 days ahead."
              ),
          }),
          execute: async (params) => {
            if (!this.apiGroup.oneWeather) {
              throw new ToolExecutionError(
                "OneWeather API is not initialized. Please setup the provider config first."
              );
            }
            return await this.apiGroup.oneWeather.timemachineWeather(params);
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) {
                throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              }
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
        {
          id: "daily-aggragated-weather",
          displayName: "Daily Aggregation",
          description:
            "You can get the aggregated weather data for a particular date from 2nd January 1979 till long-term forecast for 1,5 years ahead.",
          schema: z.object({
            lat: z.number().min(-90).max(90).describe("Latitude"),
            lon: z.number().min(-180).max(180).describe("Longitude"),
            date: z
              .string()
              .describe(
                "Date in YYYY-MM-DD format. Date is available for 46+ years archive (starting from 1979-01-02) up to the 1,5 years ahead forecast to the current date"
              ),
          }),
          execute: async (params) => {
            if (!this.apiGroup.oneWeather) {
              throw new ToolExecutionError(
                "OneWeather API is not initialized. Please setup the provider config first."
              );
            }
            return await this.apiGroup.oneWeather.dailyAggragatedWeather(
              params
            );
          },
          async ensureParameters(parameters) {
            try {
              await this.schema.parseAsync(parameters);
            } catch (e) {
              if (e instanceof z.ZodError) {
                throw new ToolParameterError(JSON.stringify(z.treeifyError(e)));
              }
              throw new ToolParameterError((e as Error).message);
            }
          },
        },
      ];
    }
    return this._tools;
  }

  async execute(toolId: string, parameters: unknown): Promise<string> {
    const tool = this.tools.find((tool) => tool.id === toolId);
    if (!tool) {
      throw new ToolRegistryError(`Tool ${toolId} not found`);
    }
    await tool.ensureParameters(parameters);
    return await tool.execute(parameters);
  }
}
