"use client";

import { DepartmentNetwork } from "@/components/departments/department-network";

export type CircularItem = {
  id: string;
  title: string;
  slug: string;
};

type CircularSelectorProps = {
  items: CircularItem[];
  activeId: string;
  onSelect: (id: string) => void;
};

/**
 * The public explorer used to force every label into a 60px circle and an
 * orbit. That worked for short English labels, but made Persian department
 * names into narrow three-line columns. Keep the selector contract stable for
 * the explorer while rendering adaptive editorial nodes instead.
 */
export function CircularSelector({
  items,
  activeId,
  onSelect,
}: CircularSelectorProps) {
  return (
    <DepartmentNetwork
      items={items}
      activeId={activeId}
      onSelect={onSelect}
      centerDescription="انتخاب یک حوزه"
    />
  );
}
