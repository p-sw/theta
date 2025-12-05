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
    onOpenChange?.(false);
    form.reset();
  };

  const [generatingTitle, setGeneration] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(open: boolean) => {
        onOpenChange?.(open);
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
                            setGeneration(true);
                            const title = await simpleTitleWrite(
                              SESSION_STORAGE_KEY(sessionId),
                              sessionStorage
                            );
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
              <Button type="submit" disabled={!form.formState.isValid}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
