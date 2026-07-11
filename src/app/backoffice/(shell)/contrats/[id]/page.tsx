import { getContractDetail } from "../../../actions";
import { ContractEditor } from "./contract-editor";

export const dynamic = "force-dynamic";

export default async function BoContractEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getContractDetail(id).catch(() => null);

  if (!detail) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <h1 className="text-lg font-bold text-gray-900">Contrat introuvable</h1>
        <p className="text-sm text-gray-500 mt-1">Ce contrat n'existe pas ou a été supprimé.</p>
      </div>
    );
  }

  return <ContractEditor detail={detail as any} />;
}
