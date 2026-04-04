/* import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/pipeline");
} */


import LandingPage from "@/components/landing-page";

export default function HomePage() {
  return <LandingPage />;
}