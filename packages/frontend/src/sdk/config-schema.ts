export type IConfigSchema =
  | IConfigSchemaNumber
  | IConfigSchemaString
  | IConfigSchemaBoolean
  | IConfigSchemaArray
  | IConfigSchemaEnum
  | IConfigSchemaEnumGroup;

export interface IConfigSchemaBase {
  displayName: string;
  description: string;
  disabled?: boolean | { $ref: string; not?: boolean };
}

export interface IConfigSchemaNumber extends IConfigSchemaBase {
  type: "number";
  min: number | { $ref: string };
  max: number | { $ref: string };
  step: number;
}

export interface IConfigSchemaString extends IConfigSchemaBase {
  type: "string" | "textarea";
}

export interface IConfigSchemaBoolean extends IConfigSchemaBase {
  type: "boolean";
}

export interface IConfigSchemaArray extends IConfigSchemaBase {
  type: "array";
  items: Omit<IConfigSchema, "displayName" | "description">;
}

export interface IConfigSchemaEnum extends IConfigSchemaBase {
  type: "enum";
  placeholder: string;
  items: { name: string; value: string }[];
}

export interface IConfigSchemaEnumGroup extends IConfigSchemaBase {
  type: "enumgroup";
  placeholder: string;
  items: {
    label: string;
    items: { name: string; value: string }[];
  }[];
}