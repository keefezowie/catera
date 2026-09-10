import { redirect } from "next/navigation";
import { userId } from "@/lib/auth";
export default async function Page() {
  redirect((await userId()) ? "/workspaces" : "/login");
}
