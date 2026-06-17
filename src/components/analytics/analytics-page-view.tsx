"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { pushPageView } from "@/lib/analytics";
import { getPageInfo } from "@/lib/page-info";

interface AnalyticsPageViewProps {
  orgId: string;
  userId: string;
  userRole: string;
  plan?: string;
}

export function AnalyticsPageView({ orgId, userId, userRole, plan }: AnalyticsPageViewProps) {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(function() {
    // Évite le double push : ne pousse que si le pathname a vraiment changé
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    var info = getPageInfo(pathname);
    pushPageView({
      page_type: info.page_type,
      page_name: info.page_name,
      org_id: orgId,
      user_id: userId,
      user_role: userRole,
      plan: plan,
    });
  }, [pathname, orgId, userRole, plan]);

  return null;
}