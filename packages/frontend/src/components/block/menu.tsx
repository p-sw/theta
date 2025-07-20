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
import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export default function Menu() {
  const [theme, setTheme] = useTheme();
  const [_, setPath] = usePath();

  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const [saveSessionDialogOpen, setSaveSessionDialogOpen] = useState(false);

  return (
    <>
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
            <DropdownMenuItem
              onClick={() => dispatchEvent(CLEAR_SESSION_EVENT)}
            >
              <LucideTrash className="size-4" /> Clear this session
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSaveSessionDialogOpen(true)}>
              <LucideSave className="size-4" /> Save this session
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={saveSessionDialogOpen}
        onOpenChange={setSaveSessionDialogOpen}
      >
        <SaveSessionItem />
      </Dialog>
    </>
  );
}

export interface SaveSessionForm {
  title: string;
}
const formSchema = z.object({
  title: z.string().min(1, {
    message: "Title is required",
  }),
});
export function SaveSessionItem() {
  const form = useForm({
    defaultValues: {
      title: "",
    },
    resolver: zodResolver(formSchema),
  });
  const onSubmit = (data: SaveSessionForm) => {
    dispatchEvent(SAVE_SESSION_EVENT, { detail: { title: data.title } });
  };
  return (
    <DialogContent>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Save this session</DialogTitle>
            <DialogDescription>
              Save this session to your local storage.
            </DialogDescription>
          </DialogHeader>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button type="submit" disabled={!form.formState.isValid}>
                Save
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
