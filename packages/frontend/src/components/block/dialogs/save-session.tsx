import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dispatchEvent } from "@/lib/utils.ts";
import { SAVE_SESSION_EVENT, SESSION_STORAGE_KEY } from "@/lib/const.ts";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import CreationOutline from "~icons/mdi/creation-outline";
import Loading from "~icons/mdi/loading";
import { simpleTitleWrite } from "@/sdk/simple-title-writer";
import { sessionStorage } from "@/lib/storage";
import type { TemporarySession } from "@/sdk/shared";
import { useState } from "react";

export interface SaveSessionForm {
  title: string;
}
const formSchema = z.object({
  title: z.string().min(1, {
    message: "Title is required",
  }),
});
export function SaveSessionItem({
  open,
  onOpenChange,
  sessionId,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  sessionId?: string;
}) {
  const form = useForm({
    defaultValues: {
      title: "",
    },
    resolver: zodResolver(formSchema),
  });
  const onSubmit = (data: SaveSessionForm) => {
    dispatchEvent(SAVE_SESSION_EVENT, {
      detail: { title: data.title, sessionId },
    });
  };

  const [generatingTitle, setGeneration] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(open: boolean) => {
        onOpenChange?.(open);
        form.reset();
      }}
    >
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
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
                    <div className="flex flex-row justify-center items-center w-full gap-2">
                      <Input {...field} />
                      {sessionId && (
                        <Button
                          type="button"
                          size="icon"
                          onClick={async () => {
                            // get first request message by session id
                            const session = JSON.parse(
                              sessionStorage.getItem(
                                SESSION_STORAGE_KEY(sessionId)
                              )!
                            ) as TemporarySession;
                            const firstRequest = session.turns.find(
                              (value) => value.type === "request"
                            );
                            if (!firstRequest) return;
                            let firstMessage = "";
                            for (const message of firstRequest.message.filter(
                              (v) => v.type === "text"
                            )) {
                              firstMessage = firstMessage + message.text + "\n";
                            }
                            setGeneration(true);
                            const title = await simpleTitleWrite(firstMessage);
                            if (!title) return;
                            form.setValue("title", title, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                            setGeneration(false);
                          }}
                        >
                          {generatingTitle ? (
                            <Loading className="animate-spin" />
                          ) : (
                            <CreationOutline />
                          )}
                        </Button>
                      )}
                    </div>
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
    </Dialog>
  );
}
