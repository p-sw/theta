import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
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

export function PathProvider({ children }: PropsWithChildren) {
  const allowed = useMemo(() => new Set<string>(Object.values(PATHS)), []);

  // Use a conservative initial state; sync to URL after mount
  const [path, setPathState] = useState<string>(() => {
    try {
      const initialUrlPath = window.location.pathname;
      return allowed.has(initialUrlPath) ? initialUrlPath : PATHS.CHAT;
    } catch {
      return PATHS.CHAT;
    }
  });

  const setPath = useCallback<Dispatch<SetStateAction<string>>>(
    (next) => {
      setPathState((prev) => {
        const nextPath =
          typeof next === "function" ? (next as (p: string) => string)(prev) : next;
        if (nextPath === prev) return prev;
        if (!allowed.has(nextPath)) return prev;
        try {
          window.history.pushState({ path: nextPath }, "", nextPath);
        } catch {
          // ignore history errors in non-browser environments
        }
        return nextPath;
      });
    },
    [allowed]
  );

  // Sync context state with current URL after DOM loads and on back/forward
  useEffect(() => {
    try {
      const urlPath = window.location.pathname;
      if (allowed.has(urlPath)) setPath(urlPath);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPopState = () => {
      try {
        const urlPath = window.location.pathname;
        if (allowed.has(urlPath)) {
          setPathState((prev) => (prev === urlPath ? prev : urlPath));
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [allowed]);

  return (
    <PathContext.Provider value={{ path, setPath }}>{children}</PathContext.Provider>
  );
}
