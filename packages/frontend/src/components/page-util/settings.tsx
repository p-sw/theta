import type { ReactNode } from "react";

export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-medium">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function SettingsSubSection({
  children,
  title,
  subsectionActions,
}: {
  children: ReactNode;
  title: string;
  subsectionActions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {subsectionActions ? (
        <div className="flex flex-row justify-between">
          <h3 className="text-lg font-medium">{title}</h3>
          {subsectionActions}
        </div>
      ) : (
        <h3 className="text-lg font-medium">{title}</h3>
      )}
      {children}
    </div>
  );
}
