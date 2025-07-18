import { Appearance } from "@/components/block/settings/appearance";
import { Providers } from "@/components/block/settings/providers";

export default function Setting() {
  return (
    <main>
      {/* PC nav for setting */}
      <div className="flex flex-col gap-16 p-8">
        <Appearance />
        <Providers />
      </div>
    </main>
  );
}
