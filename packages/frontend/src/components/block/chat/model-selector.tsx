"use client";

import * as React from "react";
import ChevronsUpDownIcon from "~icons/lucide/chevrons-up-down";
import CheckIcon from "~icons/lucide/check";

import { cn, useStorage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MODELS } from "@/lib/const";
import type { IModelInfo } from "@/sdk/shared";

export function ModelSelector({
  modelId,
  setModelId,
}: {
  modelId: string;
  setModelId: (modelId: string) => void;
}) {
  const [models] = useStorage<IModelInfo[]>(MODELS, []);

  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="link"
          role="combobox"
          aria-expanded={open}
          className="w-fit space-x-1"
        >
          {modelId
            ? models.find((m) => m.id === modelId)?.displayName
            : "Select model..."}
          <ChevronsUpDownIcon className="h-2 w-2 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search model..." />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model.id}
                  value={model.id}
                  onSelect={(currentValue) => {
                    setModelId(currentValue === modelId ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      modelId === model.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {model.displayName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
