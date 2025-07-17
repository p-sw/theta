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
import { PATH, PATHS, THEME, type ITheme } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import { useEffect } from "react";
import LucideMenu from "~icons/lucide/menu";
import LucideSun from "~icons/lucide/sun";
import LucideMoon from "~icons/lucide/moon";
import LucideMessageCircleMore from "~icons/lucide/message-circle-more";
import LucideSettings from "~icons/lucide/settings";

export default function Menu() {
  const [theme, setTheme] = useStorage<ITheme>(
    THEME,
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  const [_, setPath] = useStorage<string>(PATH, PATHS.CHAT, undefined, {
    temp: true,
  });

  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 right-4 z-50"
        >
          <LucideMenu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
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
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setPath(PATHS.CHAT)}>
            <LucideMessageCircleMore className="size-4" /> Chat
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPath(PATHS.SETTINGS)}>
            <LucideSettings className="size-4" /> Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
