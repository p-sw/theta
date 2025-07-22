import { usePath, useSessionKeys } from "@/lib/storage-hooks.ts";
import {
  PermanentSessionItem,
  TemporarySessionItem,
} from "@/components/block/session/session-item.tsx";
import { Button } from "@/components/ui/button.tsx";
import LucidePlus from "~icons/lucide/plus";
import LucideSettings from "~icons/lucide/settings";
import { use, useMemo, useState } from "react";
import { ChatContext } from "@/page/context/Chat.tsx";
import {
  NEW_SESSION_EVENT,
  PATHS,
  SESSION_STORAGE_ID,
  SESSION_STORAGE_KEY,
} from "@/lib/const.ts";
import { dispatchEvent } from "@/lib/utils.ts";
import { SaveSessionItem } from "@/components/block/menu.tsx";

export function DesktopNav() {
  const permanentKeys = useSessionKeys({ sessionStorage: false });
  const temporaryKeys = useSessionKeys({ sessionStorage: true });
  const { sessionId } = use(ChatContext);
  const sessionKey = useMemo(() => SESSION_STORAGE_KEY(sessionId), [sessionId]);

  const [_, setPath] = usePath();
  const [saveSessionDialogOpen, setSaveSessionDialogOpen] = useState(false);
  const [saveSessionDialogKey, setSaveSessionDialogKey] =
    useState<string>(sessionKey);

  return (
    <nav className="hidden md:flex w-xs flex-col justify-between items-start gap-4 p-4 border-r">
      <div className="w-full space-y-8">
        {/* session list */}
        <div className={"w-full flex flex-col gap-2"}>
          <span className={"font-medium pl-3"}>Saved Sessions</span>
          <div className={"flex flex-col gap-2 items-center"}>
            {permanentKeys.length === 0 && (
              <p className="text-sm text-muted-foreground w-full text-left pl-3">
                No saved sessions found
              </p>
            )}
            {permanentKeys.map((key) => (
              <PermanentSessionItem
                sessionKey={key}
                key={key}
                compact
                highlight={key === sessionKey}
              />
            ))}
          </div>
        </div>
        <div className={"w-full flex flex-col gap-2"}>
          <span className={"font-medium pl-3"}>Unsaved Sessions</span>
          <div className={"flex flex-col gap-1 items-center"}>
            {temporaryKeys.length === 0 && (
              <p
                className={
                  "text-sm text-muted-foreground w-full text-left pl-3"
                }
              >
                No unsaved sessions found
              </p>
            )}
            {temporaryKeys.map((key) => (
              <TemporarySessionItem
                sessionKey={key}
                key={key}
                compact
                highlight={key === sessionKey}
                onSave={() => {
                  setSaveSessionDialogKey(key);
                  setSaveSessionDialogOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="w-full space-y-2">
        {/* new session, settings btn */}
        <Button
          onClick={() => {
            dispatchEvent(NEW_SESSION_EVENT);
            setPath(PATHS.CHAT);
          }}
          className={"w-full"}
        >
          <LucidePlus />
          <span>New Session</span>
        </Button>
        <Button
          variant={"secondary"}
          onClick={() => setPath(PATHS.SETTINGS)}
          className={"w-full"}
        >
          <LucideSettings />
          <span>Settings</span>
        </Button>
      </div>
      <SaveSessionItem
        open={saveSessionDialogOpen}
        onOpenChange={setSaveSessionDialogOpen}
        sessionId={SESSION_STORAGE_ID(saveSessionDialogKey)}
      />
    </nav>
  );
}
