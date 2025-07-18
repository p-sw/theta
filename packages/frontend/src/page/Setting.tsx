import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { THEME, type ITheme } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import { useId } from "react";
import LucideSun from "~icons/lucide/sun";
import LucideMoon from "~icons/lucide/moon";
import {
  SettingsSection,
  SettingsSubSection,
} from "@/components/block/settings";

function Appearance() {
  const themeLightId = useId();
  const themeDarkId = useId();

  const [theme, setTheme] = useStorage<ITheme>(THEME, "light");

  return (
    <SettingsSection
      id={"settings-appearance"}
      title="Appearance"
      description="Choose your preferred visual style for the application."
    >
      <SettingsSubSection title="Theme">
        <RadioGroup value={theme} onValueChange={setTheme}>
          <div className="flex flex-row gap-4 border rounded-md cursor-pointer *:cursor-pointer bg-light-background text-light-foreground border-light-border *:border-light-border">
            <RadioGroupItem
              value="light"
              id={themeLightId}
              className="my-4 ml-4"
            />
            <Label htmlFor={themeLightId} className="py-4 pr-4 w-full">
              <LucideSun className="size-4" />
              Light
            </Label>
          </div>
          <div className="flex flex-row gap-4 border rounded-md cursor-pointer *:cursor-pointer bg-dark-background text-dark-foreground border-dark-border *:border-dark-border">
            <RadioGroupItem
              value="dark"
              id={themeDarkId}
              className="my-4 ml-4"
            />
            <Label htmlFor={themeDarkId} className="py-4 pr-4 w-full">
              <LucideMoon className="size-4" />
              Dark
            </Label>
          </div>
        </RadioGroup>
      </SettingsSubSection>
    </SettingsSection>
  );
}

export default function Setting() {
  return (
    <main>
      {/* PC nav for setting */}
      <div className="flex flex-col gap-4 p-8">
        <Appearance />
      </div>
    </main>
  );
}
