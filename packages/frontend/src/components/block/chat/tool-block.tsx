import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LucideLoaderCircle from "~icons/lucide/loader-circle";
import type {
  SessionTurnsTool,
  IToolProviderMeta,
  IToolMetaJson,
} from "@/sdk/shared";
import { useToolInformation, useIsToolWhitelisted } from "@/lib/tools";
import LucideMoveDiagonal from "~icons/lucide/move-diagonal";
import LucideCheck from "~icons/lucide/check";
import LucideCircleMinus from "~icons/lucide/circle-minus";
import LucideCircleAlert from "~icons/lucide/circle-alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import LucideX from "~icons/lucide/x";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ScrollArea,
  ScrollAreaViewport,
  ScrollBar,
} from "@/components/ui/scroll-area";

function prettyJson(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

export function ToolUseCard({
  message,
  onGrant,
  onReject,
}: {
  message: SessionTurnsTool;
  onGrant: () => Promise<void>;
  onReject: () => void;
}) {
  const { provider, tool } = useToolInformation(message.toolName);
  const isWhitelisted = useIsToolWhitelisted(message.toolName);

  return (
    <Card className="w-full mb-8" data-message-role="tool">
      <CardHeader>
        <CardTitle className="col-span-2 sm:col-span-1 flex items-center gap-1">
          {message.done ? (
            message.granted ? (
              message.isError ? (
                <LucideCircleAlert className="w-4 h-4 inline-block mr-2" />
              ) : (
                <LucideCheck className="w-4 h-4 inline-block mr-2" />
              )
            ) : (
              <LucideCircleMinus className="w-4 h-4 inline-block mr-2" />
            )
          ) : (
            <LucideLoaderCircle className="w-4 h-4 animate-spin inline-block mr-2" />
          )}
          <span>{tool?.displayName ?? "Unknown tool"}</span>
          {isWhitelisted && (
            <Badge variant="secondary" className="ml-2">
              Whitelisted
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {provider?.displayName ?? "Unknown provider"}
        </CardDescription>
        <CardAction className="self-center gap-2 items-center hidden sm:flex">
          {message.done ? (
            message.granted ? (
              message.isError ? (
                <p className="text-destructive text-sm inline-block">
                  Execution failed
                </p>
              ) : (
                <p className="text-green-500 text-sm inline-block">Done</p>
              )
            ) : (
              <p className="text-destructive text-sm inline-block">
                Execution rejected
              </p>
            )
          ) : message.granted ? (
            <p className="text-muted-foreground text-sm inline-block">
              Executing...
            </p>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="default" onClick={onGrant}>
                    <LucideCheck className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grant</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="destructive" onClick={onReject}>
                    <LucideCircleMinus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject</TooltipContent>
              </Tooltip>
            </>
          )}
          <DetailDialog
            provider={provider}
            tool={tool}
            message={message}
            onGrant={onGrant}
            onReject={onReject}
          >
            <Button variant="secondary" size="icon" className="ml-4">
              <LucideMoveDiagonal className="w-4 h-4" />
            </Button>
          </DetailDialog>
        </CardAction>
      </CardHeader>
      <CardFooter className="grid grid-cols-2 grid-rows-2 gap-2 sm:hidden">
        {message.done ? (
          message.granted ? (
            message.isError ? (
              <p className="text-destructive text-sm inline-block col-span-2 text-center">
                Execution failed
              </p>
            ) : (
              <p className="text-green-500 text-sm inline-block col-span-2 text-center">
                Done
              </p>
            )
          ) : (
            <p className="text-destructive text-sm inline-block col-span-2 text-center">
              Execution rejected
            </p>
          )
        ) : message.granted ? (
          <p className="text-muted-foreground text-sm inline-block col-span-2 text-center">
            Executing...
          </p>
        ) : (
          <>
            <Button onClick={onGrant}>
              <LucideCheck className="w-4 h-4" />
              Grant
            </Button>
            <Button variant="destructive" onClick={onReject}>
              <LucideCircleMinus className="w-4 h-4" />
              Reject
            </Button>
          </>
        )}

        <DetailDialog
          provider={provider}
          tool={tool}
          message={message}
          onGrant={onGrant}
          onReject={onReject}
        >
          <Button variant="secondary" className="col-span-2">
            <LucideMoveDiagonal className="w-4 h-4" />
            Show details
          </Button>
        </DetailDialog>
      </CardFooter>
    </Card>
  );
}

function DetailDialog({
  provider,
  tool,
  message,
  onGrant,
  onReject,
  children,
}: {
  message: SessionTurnsTool;
  provider?: IToolProviderMeta;
  tool?: IToolMetaJson;
  onGrant: () => Promise<void>;
  onReject: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>{children}</DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Show details</TooltipContent>
      </Tooltip>
      <DialogContent className="max-h-7/8 grid-cols-1">
        <DialogHeader>
          <DialogTitle>Tool execution details</DialogTitle>
          <DialogDescription>
            AI requested the tool execution.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="col-span-1 max-h-96 overflow-hidden">
          <ScrollAreaViewport className="snap-y snap-mandatory w-full h-full">
            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
                <span className="font-semibold text-muted-foreground">
                  Provider
                </span>
                <span>{provider?.displayName ?? "Unknown provider"}</span>
                <span className="font-semibold text-muted-foreground">
                  Tool
                </span>
                <span>{tool?.displayName ?? "Unknown tool"}</span>
              </div>
              <p className="font-bold text-sm">Request Data</p>
              <code className="block bg-muted p-2 rounded-md min-w-full w-fit">
                <pre className="text-sm text-muted-foreground min-w-full w-fit">
                  {prettyJson(message.requestContent)}
                </pre>
              </code>
              {message.done && (
                <>
                  <p className="font-bold text-sm">Response Data</p>
                  <code className="block bg-muted p-2 rounded-md min-w-full w-fit">
                    <pre className="text-sm text-muted-foreground min-w-full w-fit">
                      {prettyJson(message.responseContent)}
                    </pre>
                  </code>
                </>
              )}
            </div>
          </ScrollAreaViewport>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <DialogFooter>
          {!message.done && !message.granted && (
            <>
              <DialogClose asChild>
                <Button onClick={onGrant}>
                  <LucideCheck className="w-4 h-4" /> Grant
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive" onClick={onReject}>
                  <LucideCircleMinus className="w-4 h-4" /> Reject
                </Button>
              </DialogClose>
            </>
          )}
          {!message.done && message.granted && (
            <p className="text-muted-foreground text-sm">
              Tool is executing...
            </p>
          )}
          <DialogClose asChild>
            <Button>
              <LucideX className="w-4 h-4" />
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
