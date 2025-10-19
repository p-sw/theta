import LucideLoaderCircle from "~icons/lucide/loader-circle";

export default function Loading() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center">
      <LucideLoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
