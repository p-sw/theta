import type { JSONSchema7 } from "json-schema";

export interface IAnthropicModelConfig {
  temperature: number;
  maxOutput: number;
  stopSequences: string[];
  extendedThinking: boolean;
  thinkingBudget: number;
}

export interface IAnthropicToolSchema {
  name: string; // ^[a-zA-Z0-9_-]{1,64}$
  description: string;
  input_schema: JSONSchema7;
}

type AnthropicErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "permission_error"
  | "not_found_error"
  | "request_too_large"
  | "rate_limit_error"
  | "api_error"
  | "overloaded_error"
  | "timeout_error" // from List-Models response docs
  | "billing_error"; // from List-Models response docs

export type AnthropicStopReason =
  | "end_turn"
  | "max_tokens"
  | "stop_sequence"
  | "tool_use"
  | "pause_turn"
  | "refusal";

export interface IAnthropicErrorBody<
  T extends AnthropicErrorType = AnthropicErrorType
> {
  type: "error";
  error: {
    type: T;
    message: string;
  };
}

export interface IAnthropicListModelsBody {
  data: {
    created_at: string; // RFC 3339 datetime format
    display_name: string;
    id: string;
    type: "model";
  }[];
  first_id: string | null;
  has_more: boolean;
  last_id: string | null;
}

/* IMessage */
export interface IAnthropicMessage {
  role: "user" | "assistant";
  content: (
    | IAnthropicMessageText
    | IAnthropicMessageThinking
    | IAnthropicMessageRedactedThinking
    | IAnthropicMessageToolUse
    | IAnthropicMessageToolResult
  )[];
}

export interface IAnthropicMessageToolUse {
  id: string;
  input: object;
  name: string;
  type: "tool_use";
  cache_control?: IAnthropicMessageCacheControl | null;
}

export interface IAnthropicMessageToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

// TODO: image, file, search operation, mcp, web search, code execution, server tool, container upload

export interface IAnthropicMessageThinking {
  signature: string;
  thinking: string;
  type: "thinking";
}

export interface IAnthropicMessageRedactedThinking {
  data: string;
  type: "redacted_thinking";
}

export interface IAnthropicMessageText {
  type: "text";
  text: string;
  cache_control?: IAnthropicMessageCacheControl | null;
  citations?: AnthropicCitation[] | null;
}

export interface IAnthropicMessageCacheControl {
  type: "ephemeral";
  ttl?: "5m" | "1h";
}

export type AnthropicCitation =
  | IAnthropicMessageCitationCharacterLocation
  | IAnthropicMessageCitationPageLocation
  | IAnthropicMessageCitationBlockLocation
  | IAnthropicMessageCitationRequestWebSearchResultLocationCitation
  | IAnthropicMessageCitationRequestSearchResultLocationCitation;

export interface IAnthropicMessageCitationCharacterLocation {
  type: "char_location";
  cited_text: string;
  document_index: number; // integer >= 0
  document_title: string | null; // 1 <= length <= 255
  end_char_index: number;
  start_char_index: number; // integer >= 0
}
export interface IAnthropicMessageCitationPageLocation {
  type: "page_location";
  cited_text: string;
  document_index: number; // integer >= 0
  document_title: string | null; // 1 <= length <= 255
  end_page_number: number;
  start_page_number: number; // integer >= 1
}
export interface IAnthropicMessageCitationBlockLocation {
  type: "content_block_location";
  cited_text: string;
  document_index: number; // integer >= 0
  document_title: string | null; // 1 <= length <= 255
  end_block_number: number;
  start_block_number: number; // integer >= 0
}
export interface IAnthropicMessageCitationRequestWebSearchResultLocationCitation {
  type: "web_search_result_location";
  cited_text: string;
  encrypted_index: string;
  title: string | null; // 1 <= length <= 512
  url: string; // 1 <= length <= 2048
}
export interface IAnthropicMessageCitationRequestSearchResultLocationCitation {
  type: "search_result_location";
  cited_text: string;
  end_block_index: number;
  search_result_index: number; // integer >= 0
  source: string;
  start_block_index: number; // integer >= 0
  title: string | null;
}

export type IAnthropicMessageResultData =
  | IAnthropicMessageResultContentBlockStart
  | IAnthropicMessageResultContentBlockDelta
  | IAnthropicMessageResultContentBlockStop
  | IAnthropicMessageResultThinkingStart
  | IAnthropicMessageResultThinkingDelta
  | IAnthropicMessageResultThinkingSignatureDelta
  | IAnthropicMessageResultToolUseStart
  | IAnthropicMessageResultToolUseDelta
  | IAnthropicMessageResultMessageDelta
  | IAnthropicMessageResultMessageStart
  | IAnthropicMessageResultMessageStop
  | IAnthropicMessageResultPing
  | IAnthropicErrorBody;

export interface IAnthropicMessageResultThinkingStart {
  type: "content_block_start";
  index: number;
  content_block: {
    type: "thinking";
    thinking: string;
  };
}

export interface IAnthropicMessageResultThinkingDelta {
  type: "content_block_delta";
  index: number;
  delta: {
    type: "thinking_delta";
    thinking: string;
  };
}

export interface IAnthropicMessageResultThinkingSignatureDelta {
  type: "content_block_delta";
  index: number;
  delta: {
    type: "signature_delta";
    signature: string;
  };
}

export interface IAnthropicMessageResultToolUseStart {
  type: "content_block_start";
  index: number;
  content_block: {
    type: "tool_use";
    id: string;
    name: string;
    input: object;
  };
}

export interface IAnthropicMessageResultToolUseDelta {
  type: "content_block_delta";
  index: number;
  delta: {
    type: "input_json_delta";
    partial_json: string;
  };
}

export interface IAnthropicMessageResultPing {
  type: "ping";
}

export interface IAnthropicMessageResultMessageStart {
  type: "message_start";
  message: {
    id: string;
    type: "message";
    role: "assistant";
    // ...
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
}

export interface IAnthropicMessageResultMessageStop {
  type: "message_stop";
}

export interface IAnthropicMessageResultContentBlockStart {
  type: "content_block_start";
  index: number;
  content_block: {
    type: "text";
    text: string;
  };
}

export interface IAnthropicMessageResultContentBlockDelta {
  type: "content_block_delta";
  index: number;
  delta: {
    type: "text_delta";
    text: string;
  };
}

export interface IAnthropicMessageResultContentBlockStop {
  type: "content_block_stop";
  index: number;
}

export interface IAnthropicMessageResultMessageDelta {
  type: "message_delta";
  delta: {
    stop_reason: AnthropicStopReason;
    stop_sequence: string | null;
  };
  usage?: {
    input_tokens?: number;
    output_tokens: number;
  };
}
