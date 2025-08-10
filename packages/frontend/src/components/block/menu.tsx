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
import { NEW_SESSION_EVENT, PATHS } from "@/lib/const";
import { useEffect, useState } from "react";
import LucideMenu from "~icons/lucide/menu";
import LucideSun from "~icons/lucide/sun";
import LucideMoon from "~icons/lucide/moon";
import LucideMessageCircleMore from "~icons/lucide/message-circle-more";
import LucideSettings from "~icons/lucide/settings";
import LucideHistory from "~icons/lucide/history";
import { usePath, useTheme } from "@/lib/storage-hooks";
import LucidePlus from "~icons/lucide/plus";
import LucideSave from "~icons/lucide/save";
import { dispatchEvent } from "@/lib/utils";
import { SaveSessionItem } from "@/components/block/dialogs/save-session";
import LucideUpload from "~icons/lucide/upload";
import LucideDownload from "~icons/lucide/download";
import { useRef } from "react";
import { downloadLocalStorageExport, importLocalStorageFromFile } from "@/lib/import-export";

export default function Menu() {
  const [theme, setTheme] = useTheme();
  const [_, setPath] = usePath();

  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const [saveSessionDialogOpen, setSaveSessionDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-background/75 dark:bg-background/75 border-b backdrop-blur-sm flex flex-row justify-between items-center px-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
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
          <DropdownMenuSeparator className={"md:hidden"} />
          <DropdownMenuLabel className={"md:hidden"}>Page</DropdownMenuLabel>
          <DropdownMenuGroup className={"md:hidden"}>
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
          <DropdownMenuSeparator className={"md:hidden"} />
          <DropdownMenuLabel className={"md:hidden"}>
            Session Control
          </DropdownMenuLabel>
          <DropdownMenuGroup className={"md:hidden"}>
            <DropdownMenuItem
              onClick={() => {
                dispatchEvent<undefined>(NEW_SESSION_EVENT, {});
                setPath(PATHS.CHAT);
              }}
            >
              <LucidePlus className="size-4" /> New session
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSaveSessionDialogOpen(true)}>
              <LucideSave className="size-4" /> Save this session
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Import/Export</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                downloadLocalStorageExport();
              }}
            >
              <LucideDownload className="size-4" /> Export Everything
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <LucideUpload className="size-4" /> Import Everything
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            await importLocalStorageFromFile(file, { merge: false });
          } finally {
            e.currentTarget.value = "";
          }
        }}
      />
      <SaveSessionItem
        open={saveSessionDialogOpen}
        onOpenChange={setSaveSessionDialogOpen}
      />
    </nav>
  );
}
