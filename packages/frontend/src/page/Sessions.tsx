import { useSessionKeys } from "@/lib/storage-hooks";
import {PermanentSessionItem, TemporarySessionItem} from "@/components/block/session/session-item.tsx";

export default function Sessions() {
  const permanentKeys = useSessionKeys({ sessionStorage: false });
  const temporaryKeys = useSessionKeys({ sessionStorage: true });

  return (
    <main className="min-h-svhfull p-8 flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Saved Sessions</h1>
        <div className="flex flex-col gap-2">
          {permanentKeys.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No saved sessions found
            </p>
          )}
          {permanentKeys.map((key) => (
            <PermanentSessionItem sessionKey={key} key={key} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Unsaved Sessions</h1>
        <div className="flex flex-col gap-2">
          {temporaryKeys.map((key) => (
            <TemporarySessionItem sessionKey={key} key={key} />
          ))}
        </div>
      </div>
    </main>
  );
}