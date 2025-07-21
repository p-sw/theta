import { Button } from "@/components/ui/button";
import { usePath, useSessionKeys } from "@/lib/storage-hooks";
import { dispatchEvent, useStorage } from "@/lib/utils";
import type { PermanentSession, TemporarySession } from "@/sdk/shared";
import LucideTrash2 from "~icons/lucide/trash-2";
import LucideFileSymlink from "~icons/lucide/file-symlink";
import LucideMessageCircleMore from "~icons/lucide/message-circle-more";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatContext } from "@/page/context/Chat";
import { use } from "react";
import {
  PATHS,
  SESSION_STORAGE_ID,
  STORAGE_CHANGE_EVENT_ALL,
} from "@/lib/const";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "short",
});

export default function Sessions() {
  const permanentKeys = useSessionKeys({ sessionStorage: false });
  const temporaryKeys = useSessionKeys({ sessionStorage: true });

  return (
    <main className="h-svh p-8 flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Saved Sessions</h1>
        <div className="flex flex-col gap-2">
          {permanentKeys.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No saved sessions found
            </p>
          )}
          {permanentKeys.map((key) => (
            <PermanentSessionItem sessionKey={key} key={key} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Unsaved Sessions</h1>
        <div className="flex flex-col gap-2">
          {temporaryKeys.map((key) => (
            <TemporarySessionItem sessionKey={key} key={key} />
          ))}
        </div>
      </div>
    </main>
  );
}

function PermanentSessionItem({ sessionKey }: { sessionKey: string }) {
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

  return (
    <SessionItem
      title={session.title}
      updatedAt={session.updatedAt}
      onOpen={() => {
        setIsPermanentSession(true);
        setSessionId(SESSION_STORAGE_ID(sessionKey));
        setPath(PATHS.CHAT);
      }}
      onDelete={() => {
        setIsPermanentSession(false);
        if (sessionId === SESSION_STORAGE_ID(sessionKey)) {
          setNewSession();
        }
        localStorage.removeItem(sessionKey);
        dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
      }}
      turnsLength={session.turns.length}
    />
  );
}

function TemporarySessionItem({ sessionKey }: { sessionKey: string }) {
  const { sessionId, setSessionId, setNewSession, setIsPermanentSession } =
    use(ChatContext);
  const [session] = useStorage<TemporarySession>(
    sessionKey,
    {
      id: SESSION_STORAGE_ID(sessionKey),
      turns: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    undefined,
    { temp: true }
  );
  const [_, setPath] = usePath();

  return (
    <SessionItem
      title={dateFormatter.format(new Date(session.createdAt))}
      updatedAt={session.updatedAt}
      onOpen={() => {
        setIsPermanentSession(false);
        setSessionId(SESSION_STORAGE_ID(sessionKey));
        setPath(PATHS.CHAT);
      }}
      onDelete={() => {
        setIsPermanentSession(false);
        if (sessionId === SESSION_STORAGE_ID(sessionKey)) {
          setNewSession();
        }
        sessionStorage.removeItem(sessionKey);
        dispatchEvent(STORAGE_CHANGE_EVENT_ALL);
      }}
      turnsLength={session.turns.length}
    />
  );
}

function SessionItem({
  title,
  updatedAt,
  onOpen,
  onDelete,
  turnsLength,
}: {
  title: string;
  updatedAt: number;
  onOpen: () => void;
  onDelete: () => void;
  turnsLength: number;
}) {
  return (
    <div className="border rounded-md p-2 flex flex-col gap-2">
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
