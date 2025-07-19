type ErrorType =
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

export interface IErrorBody<T extends ErrorType = ErrorType> {
  type: "error";
  error: {
    type: T;
    message: string;
  };
}

export interface IListModelsBody {
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
export interface IMessage {
  role: "user" | "assistant";
  content: (IMessageText | IMessageThinking | IMessageRedactedThinking)[];
}

// TODO: image, file, search operation, mcp, web search, code execution, server tool, container upload

export interface IMessageThinking {
  signature: string;
  thinking: string;
  type: "thinking";
}

export interface IMessageRedactedThinking {
  data: string;
  type: "redacted_thinking";
}

export interface IMessageText {
  type: "text";
  text: string;
  cache_control?: IMessageCacheControl | null;
  citations?: Citation[] | null;
}

export interface IMessageCacheControl {
  type: "ephemeral";
  ttl?: "5m" | "1h";
}

export type Citation =
  | IMessageCitationCharacterLocation
  | IMessageCitationPageLocation
  | IMessageCitationBlockLocation
  | IMessageCitationRequestWebSearchResultLocationCitation
  | IMessageCitationRequestSearchResultLocationCitation;

export interface IMessageCitationCharacterLocation {
  type: "char_location";
  cited_text: string;
  document_index: number; // integer >= 0
  document_title: string | null; // 1 <= length <= 255
  end_char_index: number;
  start_char_index: number; // integer >= 0
}
export interface IMessageCitationPageLocation {
  type: "page_location";
  cited_text: string;
  document_index: number; // integer >= 0
  document_title: string | null; // 1 <= length <= 255
  end_page_number: number;
  start_page_number: number; // integer >= 1
}
export interface IMessageCitationBlockLocation {
  type: "content_block_location";
  cited_text: string;
  document_index: number; // integer >= 0
  document_title: string | null; // 1 <= length <= 255
  end_block_number: number;
  start_block_number: number; // integer >= 0
}
export interface IMessageCitationRequestWebSearchResultLocationCitation {
  type: "web_search_result_location";
  cited_text: string;
  encrypted_index: string;
  title: string | null; // 1 <= length <= 512
  url: string; // 1 <= length <= 2048
}
export interface IMessageCitationRequestSearchResultLocationCitation {
  type: "search_result_location";
  cited_text: string;
  end_block_index: number;
  search_result_index: number; // integer >= 0
  source: string;
  start_block_index: number; // integer >= 0
  title: string | null;
}

export interface IMessageResultContentBlockStart {
  type: "content_block_start";
  index: number;
  content_block: {
    type: "text";
    text: string;
  };
}

export interface IMessageResultContentBlockDelta {
  type: "content_block_delta";
  index: number;
  delta: {
    type: "text_delta";
    text: string;
  };
}

export interface IMessageResultContentBlockStop {
  type: "content_block_stop";
  index: number;
}
