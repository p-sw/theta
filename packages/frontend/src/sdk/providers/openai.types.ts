import type { JSONSchema7 } from "json-schema";

export interface IOpenAIModelConfig {
  temperature: number; // 0-2
  maxOutput: number;
  reasoning: boolean;
  reasoningEffort: "minimal" | "low" | "medium" | "high";
}

export type IOpenAIInput =
  | IOpenAIInputMessage
  | IOpenAIOutputItem
  | IOpenAIFunctionToolCallOutput
  | IOpenAIItemReference;

export type IOpenAIOutputItem =
  | IOpenAIOutputMessage
  | IOpenAIFunctionToolCall
  | IOpenAIReasoning;

export type IOpenAIAnnotation =
  | IOpenAIFileCitation
  | IOpenAIURLCitation
  | IOpenAIContainerFileCitation
  | IOpenAIFilePath;

export interface IOpenAIItemReference {
  id: string;
  type: "item_reference";
}

type Status = "in_progress" | "completed" | "incomplete";

export interface IOpenAIOutputLogprobs {
  token: string;
  logprob: number;
  top_logprobs: { token: string; logprob: number }[];
}

export interface IOpenAIInputMessage {
  type: "message";
  role: "user" | "system" | "developer";
  status?: Status;
  content: (IOpenAIInputText | IOpenAIInputImage | IOpenAIInputFile)[];
}

export interface IOpenAIInputText {
  type: "input_text";
  text: string;
}

export interface IOpenAIInputImage {
  type: "input_image";
  detail: "high" | "low" | "auto"; // default: "auto"
  file_id?: string;
  image_url?: string; // URL or base64 data url
}

export interface IOpenAIInputFile {
  type: "input_file";
  file_data?: string;
  file_id?: string;
  file_url?: string;
  filename?: string;
}

export interface IOpenAIOutputMessage {
  type: "message";
  status: Status;
  role: "assistant";
  id: string;
  content: (IOpenAIOutputText | IOpenAIRefusal)[];
}

export interface IOpenAIOutputText {
  type: "output_text";
  text: string;
  annotations: IOpenAIAnnotation[];
}

export interface IOpenAIFileCitation {
  type: "file_citation";
  file_id: string;
  filename: string;
  index: number;
}

export interface IOpenAIURLCitation {
  type: "url_citation";
  url: string;
  title: string;
  start_index: number;
  end_index: number;
}

export interface IOpenAIContainerFileCitation {
  type: "container_file_citation";
  file_id: string;
  filename: string;
  container_id: string;
  start_index: number;
  end_index: number;
}

export interface IOpenAIFilePath {
  type: "file_path";
  file_id: string;
  index: number;
}

export interface IOpenAIRefusal {
  type: "refusal";
  refusal: string;
}

export interface IOpenAIFunctionToolCall {
  type: "function_call";
  name: string;
  call_id: string;
  arguments: string;
  id?: string;
  status?: Status;
}

export interface IOpenAIFunctionToolCallOutput {
  type: "function_call_output";
  output: string;
  call_id: string;
  id?: string;
  status?: Status;
}

export interface IOpenAIReasoning {
  type: "reasoning";
  id: string;
  summary: IOpenAISummaryText[];
  encrypted_content?: string | null;
  status?: Status;
}

export interface IOpenAISummaryText {
  type: "summary_text";
  text: string;
}

export interface IOpenAIToolSchema {
  type: "function";
  strict: boolean;
  parameters: JSONSchema7;
  name: string;
  description?: string;
}

/**
 * OUTPUT TYPES
 */

export type IOpenAIOutput =
  | IOpenAIOutputResponseCreated
  | IOpenAIOutputResponseInProgress
  | IOpenAIOutputResponseCompleted
  | IOpenAIOutputResponseFailed
  | IOpenAIOutputResponseIncomplete
  | IOpenAIOutputResponseOutputItemAdded
  | IOpenAIOutputResponseOutputItemDone
  | IOpenAIOutputResponseContentPartAdded
  | IOpenAIOutputResponseContentPartDone
  | IOpenAIOutputResponseOutputTextDelta
  | IOpenAIOutputResponseOutputTextDone
  | IOpenAIOutputResponseRefusalDelta
  | IOpenAIOutputResponseRefusalDone
  | IOpenAIOutputResponseFunctionCallArgumentsDelta
  | IOpenAIOutputResponseFunctionCallArgumentsDone
  | IOpenAIOutputResponseReasoningSummaryPartAdded
  | IOpenAIOutputResponseReasoningSummaryPartDone
  | IOpenAIOutputResponseReasoningSummaryTextDelta
  | IOpenAIOutputResponseReasoningSummaryTextDone
  | IOpenAIOutputResponseReasoningTextDelta
  | IOpenAIOutputResponseReasoningTextDone
  | IOpenAIOutputResponseOutputTextAnnotationAdded
  | IOpenAIOutputResponseQueued
  | IOpenAIOutputError;

export interface IOpenAIOutputResponseError {
  code: string;
  message: string;
}

export interface IOpenAIOutputResponse {
  id: string;
  object: "response";
  created_at: number;
  error: IOpenAIOutputResponseError | null;
  incomplete_details: {
    reason: string;
  } | null;
  instructions: string | IOpenAIInput[];
  model: string;
  output: IOpenAIOutputItem[];
  pararrel_tool_calls: boolean;
  temperature: number | null;
  tools: IOpenAIToolSchema[];
  top_p: number | null;
  background: boolean | null;
  max_output_tokens: number | null;
  max_tool_calls: number | null;
  previous_response_id: string | null;
  prompt: {
    id: string;
    variables: Record<string, unknown>;
    version: string | null;
  } | null;
  prompt_cache_key: string;
  reasoning: {
    effort: "minimal" | "low" | "medium" | "high" | null;
    summary: "auto" | "concise" | "detailed" | null;
  };
  safety_identifier: string;
  service_tier: string | null;
  status:
    | "completed"
    | "incomplete"
    | "in_progress"
    | "failed"
    | "cancelled"
    | "queued";
  // more
}

export interface IOpenAIOutputResponseCreated {
  type: "response.created";
  sequence_number: number;
  response: IOpenAIOutputResponse;
}

export interface IOpenAIOutputResponseInProgress {
  type: "response.in_progress";
  sequence_number: number;
  response: IOpenAIOutputResponse;
}

export interface IOpenAIOutputResponseCompleted {
  type: "response.completed";
  sequence_number: number;
  response: IOpenAIOutputResponse;
}

export interface IOpenAIOutputResponseFailed {
  type: "response.failed";
  sequence_number: number;
  response: IOpenAIOutputResponse;
}

export interface IOpenAIOutputResponseIncomplete {
  type: "response.incomplete";
  sequence_number: number;
  response: IOpenAIOutputResponse;
}

export interface IOpenAIOutputResponseOutputItemAdded {
  type: "response.output_item.added";
  sequence_number: number;
  output_index: number;
  item: IOpenAIOutputItem;
}

export interface IOpenAIOutputResponseOutputItemDone {
  type: "response.output_item.done";
  sequence_number: number;
  output_index: number;
  item: IOpenAIOutputItem;
}

export interface IOpenAIOutputResponseContentPartAdded {
  type: "response.content_part.added";
  sequence_number: number;
  output_index: number;
  content_index: number;
  item_id: string;
  part: IOpenAIOutputText | IOpenAIRefusal;
}

export interface IOpenAIOutputResponseContentPartDone {
  type: "response.content_part.done";
  sequence_number: number;
  output_index: number;
  content_index: number;
  item_id: string;
  part: IOpenAIOutputText | IOpenAIRefusal;
}

export interface IOpenAIOutputResponseOutputTextDelta {
  type: "response.output_text.delta";
  sequence_number: number;
  output_index: number;
  content_index: number;
  item_id: string;
  delta: string;
  logprobs: IOpenAIOutputLogprobs[];
}

export interface IOpenAIOutputResponseOutputTextDone {
  type: "response.output_text.done";
  sequence_number: number;
  output_index: number;
  content_index: number;
  item_id: string;
  text: string;
  logprobs: IOpenAIOutputLogprobs[];
}

export interface IOpenAIOutputResponseRefusalDelta {
  type: "response.refusal.delta";
  sequence_number: number;
  output_index: number;
  content_index: number;
  item_id: string;
  delta: string;
}

export interface IOpenAIOutputResponseRefusalDone {
  type: "response.refusal.done";
  sequence_number: number;
  output_index: number;
  content_index: number;
  item_id: string;
  refusal: string;
}

export interface IOpenAIOutputResponseFunctionCallArgumentsDelta {
  type: "response.function_call_arguments.delta";
  sequence_number: number;
  output_index: number;
  item_id: string;
  delta: string;
}

export interface IOpenAIOutputResponseFunctionCallArgumentsDone {
  type: "response.function_call_arguments.done";
  sequence_number: number;
  output_index: number;
  item_id: string;
  arguments: string;
}

export interface IOpenAIOutputResponseReasoningSummaryPartAdded {
  type: "response.reasoning_summary_part.added";
  sequence_number: number;
  output_index: number;
  item_id: string;
  summary_index: number;
  part: IOpenAISummaryText;
}

export interface IOpenAIOutputResponseReasoningSummaryPartDone {
  type: "response.reasoning_summary_part.done";
  sequence_number: number;
  output_index: number;
  item_id: string;
  summary_index: number;
  part: IOpenAISummaryText;
}

export interface IOpenAIOutputResponseReasoningSummaryTextDelta {
  type: "response.reasoning_summary_text.delta";
  sequence_number: number;
  output_index: number;
  item_id: string;
  summary_index: number;
  delta: string;
}

export interface IOpenAIOutputResponseReasoningSummaryTextDone {
  type: "response.reasoning_summary_text.done";
  sequence_number: number;
  output_index: number;
  item_id: string;
  summary_index: number;
  text: string;
}

export interface IOpenAIOutputResponseReasoningTextDelta {
  type: "response.reasoning_text.delta";
  sequence_number: number;
  output_index: number;
  item_id: string;
  content_index: number;
  delta: string;
}

export interface IOpenAIOutputResponseReasoningTextDone {
  type: "response.reasoning_text.done";
  sequence_number: number;
  output_index: number;
  item_id: string;
  content_index: number;
  text: string;
}

export interface IOpenAIOutputResponseOutputTextAnnotationAdded {
  type: "response.output_text.annotation.added";
  sequence_number: number;
  output_index: number;
  item_id: string;
  content_index: number;
  annotation_index: number;
  annotation: IOpenAIAnnotation;
}

export interface IOpenAIOutputResponseQueued {
  type: "response.queued";
  sequence_number: number;
  response: IOpenAIOutputResponse;
}

export interface IOpenAIOutputError {
  type: "error";
  code: string | null;
  message: string;
  param: string | null;
  sequence_number: number;
}
