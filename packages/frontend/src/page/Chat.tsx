import { Button } from "@/components/ui/button";
import { Form, FormControl, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import LucideSend from "~icons/lucide/send";

export default function Chat() {
  const form = useForm({
    defaultValues: {
      message: "",
    },
  });

  return (
    <main className="h-svh flex flex-col">
      <section className="h-full overflow-y-auto"></section>
      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit((data) => {
              console.log(data);
            });
          }}
          className="relative p-4 h-1/3"
        >
          <FormItem className="h-full">
            <FormControl>
              <Textarea
                {...form.register("message")}
                className="resize-none text-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
          <Button
            type="submit"
            className="absolute bottom-6 right-6"
            size="icon"
          >
            <LucideSend className="size-4" />
          </Button>
        </form>
      </Form>
    </main>
  );
}
