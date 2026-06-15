import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { SupportForm } from "@/components/support/support-form";
import { LifeBuoy } from "lucide-react";

export var metadata: Metadata = {
  title: "Support",
};

export default async function SupportPage() {
  var session = await auth();
  if (!session?.user) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <LifeBuoy size={22} className="text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Support & feedback</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Signalez un bug ou proposez une amélioration. Nous vous répondrons rapidement.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <SupportForm />
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        Votre message est transmis directement à l'équipe TalibCRM.
      </p>
    </div>
  );
}