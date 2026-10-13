import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";

export type SubTab = { id: string; label: string; icon?: ComponentType<{ size?: number }> };

const ACTIVE = {
  background: "color-mix(in oklch, var(--primary) 14%, transparent)",
  color: "var(--primary-dark)",
  borderColor: "color-mix(in oklch, var(--primary) 40%, transparent)",
};

/** Pemilih sub tab bersama: aktif = tint tipis warna tema (tab utama tetap solid). */
export default function SubTabs({ tabs, value, onChange, label, testIdPrefix = "tab-", testId }: {
  tabs: SubTab[]; value: string; onChange: (id: string) => void; label: string; testIdPrefix?: string; testId?: string
}) {
  return (
    <div className="flex gap-1.5 flex-wrap border-b pb-2" role="tablist" aria-label={label} data-testid={testId}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = value === t.id;
        return (
          <Button key={t.id} type="button" role="tab" aria-selected={active} variant="ghost" size="sm"
            className="min-h-9 rounded-full border border-transparent font-medium"
            style={active ? ACTIVE : { color: "var(--text-muted)" }}
            onClick={() => onChange(t.id)} data-testid={`${testIdPrefix}${t.id}`}>
            {Icon && <Icon size={14} />} {t.label}
          </Button>
        );
      })}
    </div>
  );
}
