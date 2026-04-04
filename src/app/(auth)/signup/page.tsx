import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export var metadata: Metadata = {
  title: "Créer un compte — EduCRM Africa",
};

export default async function SignupPage() {
  var session = await auth();
  if (session?.user) redirect("/pipeline");

  return <SignupForm />;
}