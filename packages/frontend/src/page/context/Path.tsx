import {
  createContext,
  type Dispatch,
  type SetStateAction,
} from "react";
import { PATHS } from "@/lib/const";

type PathContextValue = {
  path: string;
  setPath: Dispatch<SetStateAction<string>>;
};

export const PathContext = createContext<PathContextValue>({
  path: PATHS.CHAT,
  setPath: () => {},
});