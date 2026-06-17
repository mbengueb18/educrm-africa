// src/lib/page-info.ts
export function getPageInfo(pathname: string): { page_type: string; page_name: string } {
  var path = pathname.split("?")[0];
  var segments = path.split("/").filter(Boolean);
  var section = segments[0] || "";
  var hasDetail = segments.length > 1;

  // Pipeline
  if (section === "pipeline") {
    return { page_type: "pipeline", page_name: "Pipeline" };
  }
  // Leads / students
  if (section === "leads") {
    return { page_type: "leads_management", page_name: hasDetail ? "Lead Detail" : "Leads List" };
  }
  if (section === "students") {
    return { page_type: "leads_management", page_name: hasDetail ? "Student Detail" : "Students List" };
  }
  // Audiences
  if (section === "audiences") {
    return { page_type: "audiences", page_name: hasDetail ? "Audience Detail" : "Audiences List" };
  }
  // Communication
  if (section === "inbox") {
    return { page_type: "inbox", page_name: hasDetail ? "Conversation" : "Inbox" };
  }
  if (section === "campaigns") {
    return { page_type: "communication", page_name: hasDetail ? "Email Campaign Detail" : "Email Campaigns" };
  }
  if (section === "whatsapp-campaigns") {
    return { page_type: "communication", page_name: hasDetail ? "WhatsApp Campaign Detail" : "WhatsApp Campaigns" };
  }
  // Activities
  if (section === "calls") {
    return { page_type: "activities", page_name: "Calls" };
  }
  if (section === "appointments") {
    return { page_type: "activities", page_name: "Appointments" };
  }
  if (section === "tasks") {
    return { page_type: "activities", page_name: "Tasks" };
  }
  if (section === "calendar") {
    return { page_type: "activities", page_name: "Calendar" };
  }
  // Automation
  if (section === "workflows") {
    return { page_type: "automation", page_name: hasDetail ? "Workflow Detail" : "Workflows" };
  }
  // Reporting
  if (section === "analytics") {
    return { page_type: "reporting", page_name: "Analytics" };
  }
  if (section === "dashboard") {
    return { page_type: "reporting", page_name: "Dashboard" };
  }
  // Finance
  if (section === "payments") {
    return { page_type: "payments", page_name: "Payments" };
  }
  // Settings
  if (section === "settings") {
    var subName = segments[1] ? "Settings - " + segments[1] : "Settings";
    return { page_type: "settings", page_name: subName };
  }
  if (section === "profile") {
    return { page_type: "settings", page_name: "Profile" };
  }
  // Support
  if (section === "support") {
    return { page_type: "support", page_name: "Support" };
  }
  // Auth
  if (section === "login") {
    return { page_type: "auth", page_name: "Login" };
  }

  return { page_type: "other", page_name: path };
}