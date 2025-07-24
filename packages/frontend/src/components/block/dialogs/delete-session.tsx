import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
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

export interface DeleteSessionForm {
  confirmTitle: string;
}

export function DeleteSessionDialog({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
  onDelete,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  sessionId?: string;
  sessionTitle: string;
  onDelete: () => void;
}) {
  // Create a dynamic schema that validates the input matches the session title
  const formSchema = z.object({
    confirmTitle: z
      .string()
      .min(1, { message: "Confirmation is required" })
      .refine((value) => value === sessionTitle, {
        message: "Must match the session name exactly",
      }),
  });

  const form = useForm({
    defaultValues: {
      confirmTitle: "",
    },
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: DeleteSessionForm) => {
    // Only delete if the confirmation matches
    if (data.confirmTitle === sessionTitle && sessionId) {
      onDelete();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this session</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. To confirm, please type the
                session name below.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <FormField
              control={form.control}
              name="confirmTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type "{sessionTitle}" to confirm</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={sessionTitle} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!form.formState.isValid}
                >
                  Delete
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
