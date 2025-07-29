import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LucideLoaderCircle from "~icons/lucide/loader-circle";
import type { SessionTurnsTool } from "@/sdk/shared";
import { useToolInformation } from "@/lib/tools";
import LucideMoveDiagonal from "~icons/lucide/move-diagonal";
import LucideCheck from "~icons/lucide/check";
import LucideCircleMinus from "~icons/lucide/circle-minus";
import LucideCircleAlert from "~icons/lucide/circle-alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import LucideX from "~icons/lucide/x";

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
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
          {tool?.displayName ?? "Unknown tool"}
        </CardTitle>
        <CardDescription>
          {provider?.displayName ?? "Unknown provider"}
        </CardDescription>
        <CardAction className="self-center flex gap-2 items-center">
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
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="secondary" size="icon" className="ml-4">
                    <LucideMoveDiagonal className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Show details</TooltipContent>
            </Tooltip>
            <AlertDialogContent className="max-h-7/8 overflow-y-auto">
              <AlertDialogHeader>
                <AlertDialogTitle>Tool execution details</AlertDialogTitle>
                <AlertDialogDescription>
                  AI requested the tool execution.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
                <span className="font-semibold text-muted">Provider</span>
                <span>{provider?.displayName ?? "Unknown provider"}</span>
                <span className="font-semibold text-muted">Tool</span>
                <span>{tool?.displayName ?? "Unknown tool"}</span>
              </div>
              <p className="font-bold text-sm">Request Data</p>
              <code className="block bg-muted p-2 rounded-md col-span-1 overflow-x-auto">
                <pre className="text-sm text-muted-foreground">
                  {prettyJson(message.requestContent)}
                </pre>
              </code>
              {message.done && (
                <>
                  <p className="font-bold text-sm">Response Data</p>
                  <code className="block bg-muted p-2 rounded-md col-span-1 overflow-x-auto">
                    <pre className="text-sm text-muted-foreground">
                      {prettyJson(message.responseContent)}
                    </pre>
                  </code>
                </>
              )}
              <AlertDialogFooter>
                {!message.done && (
                  <>
                    <AlertDialogAction onClick={onGrant}>
                      <LucideCheck className="w-4 h-4" /> Grant
                    </AlertDialogAction>
                    <AlertDialogAction variant="destructive" onClick={onReject}>
                      <LucideCircleMinus className="w-4 h-4" /> Reject
                    </AlertDialogAction>
                  </>
                )}
                <AlertDialogCancel>
                  <LucideX className="w-4 h-4" />
                  Close
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
