"use client";

import { createContext, useContext } from "react";
import { hasPermission, getScope, type Permission, type Scope } from "@/lib/permissions";

type PermissionContextType = {
  role: string;
  userId: string;
};

export var PermissionContext = createContext<PermissionContextType>({
  role: "VIEWER",
  userId: "",
});

export function usePermissions() {
  var ctx = useContext(PermissionContext);

  return {
    role: ctx.role,
    userId: ctx.userId,

    can: function(permission: Permission): boolean {
      return hasPermission(ctx.role, permission);
    },

    scope: function(permission: Permission): Scope {
      return getScope(ctx.role, permission);
    },

    isAdmin: ctx.role === "ADMIN" || ctx.role === "SUPER_ADMIN",
    isCommercial: ctx.role === "COMMERCIAL",
    isViewer: ctx.role === "VIEWER",
  };
}