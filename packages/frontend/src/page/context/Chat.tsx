import { createContext, type Dispatch, type SetStateAction } from "react";

export const ChatContext = createContext<{
  sessionId: string;
  setSessionId: Dispatch<SetStateAction<string>>;
  setNewSession: () => void;
  isPermanentSession: boolean;
  setIsPermanentSession: Dispatch<SetStateAction<boolean>>;
}>({
  sessionId: "",
  setSessionId: () => {},
  setNewSession: () => {},
  isPermanentSession: false,
  setIsPermanentSession: () => {},
});
