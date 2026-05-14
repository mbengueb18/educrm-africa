import { getPipelinesData } from "./actions";
import PipelinesClient from "./pipelines-client";

export default async function PipelinesSettingsPage() {
  const data = await getPipelinesData();
  
  return (
    <PipelinesClient
      initialPipelines={data.pipelines}
      plan={data.plan}
      limit={data.limit}
    />
  );
}