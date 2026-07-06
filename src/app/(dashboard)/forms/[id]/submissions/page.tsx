import { getFormSubmissions } from "../../actions";
import { SubmissionsClient } from "./submissions-client";

export default async function FormSubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getFormSubmissions(id);
  return <SubmissionsClient data={data as any} />;
}
