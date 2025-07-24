import { dispatchEvent, useStorage } from "@/lib/utils";
import type { PermanentSession, TemporarySession } from "@/sdk/shared";
import LucideTrash2 from "~icons/lucide/trash-2";
import LucideFileSymlink from "~icons/lucide/file-symlink";
import LucideMessageCircleMore from "~icons/lucide/message-circle-more";
import LucideEllipsis from "~icons/lucide/ellipsis";
import LucideCalendarClock from "~icons/lucide/calendar-clock";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatContext } from "@/page/context/Chat";
import {
  type MouseEvent,
  type MouseEventHandler,
  use,
  useCallback,
  useState,
} from "react";
import {
  PATHS,
  SESSION_STORAGE_ID,
  STORAGE_CHANGE_EVENT_ALL,
} from "@/lib/const";
import { usePath, useSessionKeys } from "@/lib/storage-hooks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import LucideSave from "~icons/lucide/save";
import { DeleteSessionDialog } from "@/components/block/dialogs/delete-session.tsx";

export interface WSessionItemProps {
  sessionKey: string;
  compact?: boolean;
  highlight?: boolean;
  onSave?: () => void;
}

interface SessionItemProps {
  title: string;
  updatedAt: number;
  onOpen: MouseEventHandler;
  onDelete: MouseEventHandler;
  turnsLength: number;
  highlight: boolean;
  onSave?: () => void;
}

export function PermanentSessionItem({
  sessionKey,
  compact = false,
  highlight = false,
}: Omit<WSessionItemProps, "onSave">) {
  const [session] = useStorage<PermanentSession>(sessionKey, {
    id: SESSION_STORAGE_ID(sessionKey),
    title: "",
    turns: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const { sessionId, setSessionId, setNewSession, setIsPermanentSession } =
    use(ChatContext);
  const [_, setPath] = usePath();

  const onOpen = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      setIsPermanentSession(true);
      setSessionId(SESSION_STORAGE_ID(sessionKey));
      setPath(PATHS.CHAT);
    },
    [setSessionId, setPath, sessionKey, setIsPermanentSession],
  );

  const [deleteSessionDialogOpen, setDeleteSessionDialogOpen] = useState(false);
  const onDelete = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setDeleteSessionDialogOpen(true);
  }, []);

  const sessionKeysPerm = useSessionKeys({ sessionStorage: false });
  const sessionKeysTemp = useSessionKeys({ sessionStorage: true });

  const onDeleteAction = useCallback(() => {
    if (sessionId === SESSION_STORAGE_ID(sessionKey)) {
      // must move to another session
      setIsPermanentSession(true);
      // get another existing key
      // 1. find in perm, higher priority
      // 2. find in temp
      const anotherSessionKey = sessionKeysPerm.find(
        (key) => key !== sessionKey,
      );
      const anotherSessionKeyTemp = anotherSessionKey ?? sessionKeysTemp[0];
      if (!anotherSessionKeyTemp) {
        // if no session, create one
        setNewSession();
      } else {
        if (!anotherSessionKey) {
          // it's temp session
          setIsPermanentSession(false);
        }
        setSessionId(SESSION_STORAGE_ID(anotherSessionKeyTemp));
      }
    }
    localStorage.removeItem(sessionKey);
    dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
  }, [
    sessionId,
    sessionKey,
    setIsPermanentSession,
    sessionKeysPerm,
    sessionKeysTemp,
    setNewSession,
    setSessionId,
  ]);

  const props = {
    title: session.title,
    updatedAt: session.updatedAt,
    onOpen,
    onDelete,
    turnsLength: session.turns.length,
    highlight,
  };

  const Component = compact ? CompactSessionItem : SessionItem;

  return (
    <>
      <Component {...props} />
      <DeleteSessionDialog
        open={deleteSessionDialogOpen}
        onOpenChange={setDeleteSessionDialogOpen}
        sessionTitle={session.title}
        onDelete={onDeleteAction}
      />
    </>
  );
}

export function TemporarySessionItem({
  sessionKey,
  compact = false,
  highlight = false,
  onSave,
}: WSessionItemProps) {
  const { sessionId, setSessionId, setNewSession, setIsPermanentSession } =
    use(ChatContext);
  const [session] = useStorage<TemporarySession>(
    sessionKey,
    {
      id: SESSION_STORAGE_ID(sessionKey),
      title: new Date(Date.now()).toLocaleString(),
      turns: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    undefined,
    { temp: true },
  );
  const [_, setPath] = usePath();

  const onOpen = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      setIsPermanentSession(false);
      setSessionId(SESSION_STORAGE_ID(sessionKey));
      setPath(PATHS.CHAT);
    },
    [sessionKey, setIsPermanentSession, setPath, setSessionId],
  );

  const sessionKeysPerm = useSessionKeys({ sessionStorage: false });
  const sessionKeysTemp = useSessionKeys({ sessionStorage: true });

  const [deleteSessionDialogOpen, setDeleteSessionDialogOpen] = useState(false);

  const onDelete = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setDeleteSessionDialogOpen(true);
  }, []);

  const onDeleteAction = useCallback(() => {
    if (sessionId === SESSION_STORAGE_ID(sessionKey)) {
      // must move to another session
      setIsPermanentSession(false);
      // get another existing key
      // 1. find in temp, higher priority
      // 2. find in perm
      const anotherSessionKey = sessionKeysTemp.find(
        (key) => key !== sessionKey,
      );
      const anotherSessionKeyPerm = anotherSessionKey ?? sessionKeysPerm[0];
      if (!anotherSessionKeyPerm) {
        // if no session, create one
        setNewSession();
      } else {
        if (!anotherSessionKey) {
          // it's perm session
          setIsPermanentSession(true);
        }
        setSessionId(SESSION_STORAGE_ID(anotherSessionKeyPerm));
      }
    }
    sessionStorage.removeItem(sessionKey);
    dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
  }, [
    sessionId,
    sessionKey,
    sessionKeysPerm,
    sessionKeysTemp,
    setIsPermanentSession,
    setNewSession,
    setSessionId,
  ]);

  const props = {
    title: session.title,
    updatedAt: session.updatedAt,
    onOpen,
    onDelete,
    turnsLength: session.turns.length,
    highlight,
    onSave,
  };

  const Component = compact ? CompactSessionItem : SessionItem;

  return (
    <>
      <Component {...props} />
      <DeleteSessionDialog
        open={deleteSessionDialogOpen}
        onOpenChange={setDeleteSessionDialogOpen}
        sessionTitle={session.title}
        sessionId={session.id}
        onDelete={onDeleteAction}
      />{" "}
    </>
  );
}

function SessionItem({
  title,
  updatedAt,
  onOpen,
  onDelete,
  turnsLength,
}: SessionItemProps) {
  return (
    <div className="border rounded-md p-2 flex flex-col gap-2 w-full">
      <div className="flex flex-col gap-2 items-start p-2">
        <p>{title}</p>
        <div className="flex flex-row justify-between gap-2 items-center w-full">
          <p className="text-sm text-muted-foreground">
            {new Date(updatedAt).toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            <LucideMessageCircleMore className="w-4 h-4 inline-block mr-1" />
            {turnsLength}
          </p>
        </div>
      </div>
      <div className="flex flex-row gap-2 items-center justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="icon" onClick={onOpen}>
              <LucideFileSymlink className="w-2 h-2" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Session</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="destructive" size="icon" onClick={onDelete}>
              <LucideTrash2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Session</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function CompactSessionItem({
  title,
  updatedAt,
  onOpen,
  onDelete,
  turnsLength,
  highlight,
  onSave,
}: SessionItemProps) {
  return (
    <Button
      asChild
      variant={highlight ? "default" : "ghost"}
      className="rounded-md flex flex-row justify-between items-center gap-2 w-full group"
      onClick={onOpen}
    >
      <div>
        <span
          className={
            "h-fit text-sm font-light select-none line-clamp-1 text-ellipsis grow text"
          }
        >
          {title}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={"ghost"}
              className={
                "group-hover:opacity-100 opacity-0 transition-[opacity,background-color,color] duration-100 size-6 shrink-0"
              }
              onClick={(e) => e.stopPropagation()}
            >
              <LucideEllipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={"end"}>
            <DropdownMenuLabel
              className={"flex flex-row gap-2 items-center font-normal"}
            >
              <LucideCalendarClock className={"inline-block"} />
              <span>{new Date(updatedAt).toLocaleString()}</span>
            </DropdownMenuLabel>
            <DropdownMenuLabel
              className={"flex flex-row gap-2 items-center font-normal"}
            >
              <LucideMessageCircleMore className={"inline-block"} />
              <span>{turnsLength}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {onSave && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave();
                  }}
                >
                  <LucideSave />
                  <span>Save</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant={"destructive"} onClick={onDelete}>
                <LucideTrash2 />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Button>
  );
}
