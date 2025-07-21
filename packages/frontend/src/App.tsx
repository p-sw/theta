import Menu from "@/components/block/menu";
import { PATHS } from "@/lib/const";
import { usePath } from "@/lib/storage-hooks";
import Chat from "@/page/Chat";
import Sessions from "@/page/Sessions";
import Setting from "@/page/Setting";
import { Toaster } from "sonner";
import { useState } from "react";
import { ChatContext } from "@/page/context/Chat";
import { useHyperInstance } from "@/lib/utils";

function App() {
  const [path] = usePath();
  const hyperInstance = useHyperInstance();
  const [sessionId, setSessionId] = useState<string>(hyperInstance()); // null: new session, string: existing session
  const [isPermanentSession, setIsPermanentSession] = useState(false);

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
        <Toaster />
        <Menu />
        {path === PATHS.CHAT && <Chat />}
        {path === PATHS.SETTINGS && <Setting />}
        {path === PATHS.SESSIONS && <Sessions />}
      </ChatContext>
    </>
  );
}

export default App;
