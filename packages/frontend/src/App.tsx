import Menu from "@/components/block/menu";
import { PATHS, SESSION_STORAGE_ID } from "@/lib/const";
import { usePath, useSessionKeys } from "@/lib/storage-hooks";
import { Toaster } from "sonner";
import { useEffect, useState, lazy, Suspense } from "react";
import { ChatContext } from "@/page/context/Chat";
import { useHyperInstance } from "@/lib/utils";
import { startSyncDaemon } from "@/lib/sync";

function App() {
  const [path] = usePath();
  const hyperInstance = useHyperInstance();
  const sessionKeys = useSessionKeys({ sessionStorage: true });
  const [sessionId, setSessionId] = useState<string>(() => {
    // if there's already a session with empty turns (not used), use it instead of creating a new one
    let emptySessionId = hyperInstance();
    for (const key of sessionKeys) {
      const sessionString = sessionStorage.getItem(key);
      if (!sessionString) continue;
      try {
        const session = JSON.parse(sessionString);
        if (session.turns.length === 0) {
          emptySessionId = SESSION_STORAGE_ID(key);
          break;
        }
      } catch {
        // noop
      }
    }
    return emptySessionId;
  });
  const [isPermanentSession, setIsPermanentSession] = useState(false);

  useEffect(() => {
    startSyncDaemon();
  }, []);

  return (
    <>
      <ChatContext
        value={{
          sessionId,
          setSessionId,
          setNewSession: () => setSessionId(hyperInstance()),
          isPermanentSession,
          setIsPermanentSession,
        }}
      >
        <Toaster expand richColors />
        <Menu />
        <Suspense>
          {path === PATHS.CHAT && <Chat />}
          {path === PATHS.SETTINGS && <Setting />}
          {path === PATHS.SESSIONS && <Sessions />}
        </Suspense>
      </ChatContext>
    </>
  );
}

export default App;

// Lazy-loaded page components to enable code-splitting on build
const Chat = lazy(() => import("@/page/Chat"));
const Sessions = lazy(() => import("@/page/Sessions"));
const Setting = lazy(() => import("@/page/Setting"));
