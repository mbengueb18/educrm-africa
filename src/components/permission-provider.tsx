"use client";

import { PermissionContext } from "@/hooks/use-permissions";

export function PermissionProvider({ role, userId, children }: {
  role: string;
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <PermissionContext.Provider value={{ role, userId }}>
      {children}
    </PermissionContext.Provider>
  );
}