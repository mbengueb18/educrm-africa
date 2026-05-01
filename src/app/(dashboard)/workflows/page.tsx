import { Metadata } from "next";
import { getWorkflows } from "./actions";
import { WorkflowsListClient } from "./workflows-list-client";

export const metadata: Metadata = {
  title: "Workflows",
};

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const workflows = await getWorkflows();
  return <WorkflowsListClient workflows={workflows as any} />;
}