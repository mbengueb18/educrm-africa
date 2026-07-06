import { getForm, getFormRoutingData } from "../../actions";
import { FormBuilderClient } from "./form-builder-client";

export default async function FormEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [form, routingData] = await Promise.all([getForm(id), getFormRoutingData()]);
  return <FormBuilderClient form={form as any} routingData={routingData as any} />;
}
