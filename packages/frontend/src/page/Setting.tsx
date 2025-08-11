import { Appearance } from "@/components/block/settings/appearance";
import { Providers } from "@/components/block/settings/providers";
import { Button } from "@/components/ui/button.tsx";
import { usePath } from "@/lib/storage-hooks.ts";
import { PATHS } from "@/lib/const.ts";
import LucideArrowLeft from "~icons/lucide/arrow-left";
import { Tools } from "@/components/block/settings/tools";
import { SyncSettings } from "@/components/block/settings/sync";

export default function Setting() {
  const [_, setPath] = usePath();

  return (
    <main>
      {/* PC nav for setting */}
      <div className="flex flex-col gap-16 p-8 max-w-2xl mx-auto">
        <Button
          variant={"link"}
          className={
            "w-fit flex flex-row gap-1 items-center p-0 has-[>svg]:px-0"
          }
          onClick={() => setPath(PATHS.CHAT)}
        >
          <LucideArrowLeft />
          Back to Chat
        </Button>
        <Appearance />
        <Providers />
        <SyncSettings />
        <Tools />
      </div>
    </main>
  );
}
