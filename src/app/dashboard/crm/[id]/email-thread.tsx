"use client";

interface Activity {
  id: string;
  activity_type: string;
  content: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  created_at: string;
  created_by: string | null;
}

interface EmailThreadProps {
  activities: Activity[];
}

export default function EmailThread({ activities }: EmailThreadProps) {
  const emailActivities = activities
    .filter(
      (a) => a.activity_type === "email_sent" || a.activity_type === "email_received"
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  if (emailActivities.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
        Conversacion email ({emailActivities.length})
      </h3>

      <div className="space-y-3">
        {emailActivities.map((activity) => {
          const isSent = activity.activity_type === "email_sent";
          const meta = activity.metadata;
          const subject =
            String(meta?.email_subject || "") || null;
          const fromName =
            !isSent ? String(meta?.email_from_name || meta?.email_from || "") : null;

          return (
            <div
              key={activity.id}
              className={`flex ${isSent ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 ${
                  isSent
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {fromName && (
                  <p
                    className={`text-xs font-semibold ${
                      isSent ? "text-blue-200" : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {fromName}
                  </p>
                )}

                {subject && (
                  <p
                    className={`text-xs ${
                      isSent
                        ? "text-blue-200"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    Asunto: {subject}
                  </p>
                )}

                {activity.content && (
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {activity.content}
                  </p>
                )}

                <p
                  className={`mt-2 text-right text-[10px] ${
                    isSent
                      ? "text-blue-300"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {new Date(activity.created_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
