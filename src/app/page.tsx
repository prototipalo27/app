import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-8 p-16">
        <h1 className="text-4xl font-bold text-black dark:text-white">
          Prototipalo
        </h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Supabase status:
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-green-600">
            {error ? "Not connected" : "Connected"}
          </p>
          {data?.user && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Logged in as: {data.user.email}
            </p>
          )}
          {!data?.user && !error && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              No user logged in (anonymous access working)
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
