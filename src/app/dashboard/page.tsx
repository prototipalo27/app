import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const user = data.user;
  const provider = user.app_metadata?.provider ?? "email";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Welcome to Prototipalo
        </p>

        <div className="mt-6 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Email
            </p>
            <p className="text-sm text-zinc-900 dark:text-white">
              {user.email}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              User ID
            </p>
            <p className="font-mono text-sm text-zinc-900 dark:text-white">
              {user.id}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Provider
            </p>
            <p className="text-sm capitalize text-zinc-900 dark:text-white">
              {provider}
            </p>
          </div>
        </div>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
