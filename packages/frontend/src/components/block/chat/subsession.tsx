import { AssistantMessage } from "./assistant-message";
import { ToolUseCard } from "./tool-block";
import { UserMessage } from "./user-message";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ScrollArea,
  ScrollAreaViewport,
  ScrollBar,
} from "@/components/ui/scroll-area";
import { toolAgentManager } from "@/sdk/agent/tool-agent-manager";
import type {
  SessionTurnsRequest,
  SessionTurnsResponse,
  SessionTurnsSubSession,
  SessionTurnsTool,
} from "@/sdk/shared";
import LucideAlertTriangle from "~icons/lucide/alert-triangle";
import LucideCheck from "~icons/lucide/check";
import LucideLoaderCircle from "~icons/lucide/loader-circle";

type ParsedTurn =
  | SessionTurnsRequest
  | SessionTurnsResponse
  | SessionTurnsTool[]
  | ParsedSubsession;

type ParsedSubsession = Omit<SessionTurnsSubSession, "turns"> & {
  turns: ParsedTurn[];
};

type ParsedTurnWithType = Exclude<ParsedTurn, SessionTurnsTool[]>;

function hasType(turn: ParsedTurn): turn is ParsedTurnWithType {
  return !Array.isArray(turn);
}

export function Subsession({
  sessionId,
  subsession,
  onToolGrant,
  onToolReject,
}: {
  sessionId: string;
  subsession: ParsedSubsession;
  onToolGrant: (useId: string) => Promise<void>;
  onToolReject: (useId: string) => void;
}) {
  return (
    <Card className="mb-8 border-dashed border-muted-foreground/50 bg-muted/30">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Badge variant="secondary">Subsession</Badge>
          <span className="truncate">
            {toolAgentManager.getMetadata(subsession.toolName)?.displayName}
          </span>
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {toolAgentManager.getMetadata(subsession.toolName)?.description}
        </CardDescription>
        <CardAction>
          <StatusBadge
            isDone={subsession.isDone}
            isError={subsession.isError}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="max-h-96 overflow-hidden pr-2">
          <ScrollAreaViewport className="max-h-96 pt-2 min-h-0">
            <div className="flex flex-col gap-6">
              {subsession.turns.map((turn, index) => (
                <SubsessionTurn
                  key={`${subsession.useId}-${index}`}
                  sessionId={sessionId}
                  turn={turn}
                  onToolGrant={onToolGrant}
                  onToolReject={onToolReject}
                />
              ))}
            </div>
          </ScrollAreaViewport>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function SubsessionTurn({
  sessionId,
  turn,
  onToolGrant,
  onToolReject,
}: {
  sessionId: string;
  turn: ParsedTurn;
  onToolGrant: (useId: string) => Promise<void>;
  onToolReject: (useId: string) => void;
}) {
  if (!hasType(turn)) {
    return (
      <>
        {turn.map((tool) => (
          <ToolUseCard
            key={`${sessionId}-${tool.useId}`}
            message={tool}
            onGrant={() => onToolGrant(tool.useId)}
            onReject={() => onToolReject(tool.useId)}
          />
        ))}
      </>
    );
  }

  if (turn.type === "request") {
    return (
      <UserMessage
        sessionId={sessionId}
        messageId={turn.messageId}
        messages={turn.message}
        enableCheckout={false}
      />
    );
  }

  if (turn.type === "response") {
    return (
      <AssistantMessage
        sessionId={sessionId}
        messageId={turn.messageId}
        messages={turn.message}
        stop={turn.stop}
      />
    );
  }

  if (turn.type === "subsession") {
    return (
      <Subsession
        sessionId={sessionId}
        subsession={turn}
        onToolGrant={onToolGrant}
        onToolReject={onToolReject}
      />
    );
  }

  return null;
}

function StatusBadge({
  isDone,
  isError,
}: {
  isDone: boolean;
  isError: boolean;
}) {
  if (!isDone) {
    return (
      <Badge variant="outline" className="text-amber-700 dark:text-amber-300">
        <LucideLoaderCircle className="w-3 h-3 animate-spin" />
        In progress
      </Badge>
    );
  }

  if (isError) {
    return (
      <Badge variant="destructive">
        <LucideAlertTriangle className="w-3 h-3" />
        Failed
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      <LucideCheck className="w-3 h-3" />
      Complete
    </Badge>
  );
}
