import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CLEAR_SESSION_EVENT,
  NEW_SESSION_EVENT,
  PATHS,
  SAVE_SESSION_EVENT,
} from "@/lib/const";
import { useEffect } from "react";
import LucideMenu from "~icons/lucide/menu";
import LucideSun from "~icons/lucide/sun";
import LucideMoon from "~icons/lucide/moon";
import LucideMessageCircleMore from "~icons/lucide/message-circle-more";
import LucideSettings from "~icons/lucide/settings";
import LucideHistory from "~icons/lucide/history";
import { usePath, useTheme } from "@/lib/storage-hooks";
import LucidePlus from "~icons/lucide/plus";
import LucideTrash from "~icons/lucide/trash";
import LucideSave from "~icons/lucide/save";
import { dispatchEvent } from "@/lib/utils";

export default function Menu() {
  const [theme, setTheme] = useTheme();
  const [_, setPath] = usePath();

  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-50 bg-background dark:bg-background"
        >
          <LucideMenu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <LucideSun className="size-4" /> Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <LucideMoon className="size-4" /> Dark
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Page</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setPath(PATHS.CHAT)}>
            <LucideMessageCircleMore className="size-4" /> Chat
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPath(PATHS.SETTINGS)}>
            <LucideSettings className="size-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPath(PATHS.SESSIONS)}>
            <LucideHistory className="size-4" /> Sessions
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Session Control</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => dispatchEvent(NEW_SESSION_EVENT)}>
            <LucidePlus className="size-4" /> New session
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => dispatchEvent(CLEAR_SESSION_EVENT)}>
            <LucideTrash className="size-4" /> Clear this session
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => dispatchEvent(SAVE_SESSION_EVENT)}>
            <LucideSave className="size-4" /> Save this session
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
