"use client";

import { useCallback, useRef } from "react";
import EmailPanel from "./email-panel";
import EmailSnippetsPanel from "./email-snippets-panel";

interface Snippet {
  id: string;
  title: string;
  category: string;
  content: string;
}

interface Activity {
  id: string;
  activity_type: string;
  content: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  thread_id: string | null;
  created_at: string;
  created_by: string | null;
}

export default function EmailWithSnippets({
  activities,
  leadId,
  leadEmail,
  leadName,
  leadCompany,
  emailSubjectTag,
  snippets,
}: {
  activities: Activity[];
  leadId: string;
  leadEmail: string | null;
  leadName: string;
  leadCompany: string | null;
  emailSubjectTag: string | null;
  snippets: Snippet[];
}) {
  const bodySetterRef = useRef<((fn: (prev: string) => string) => void) | null>(null);

  const handleBodyRef = useCallback(
    (setter: (fn: (prev: string) => string) => void) => {
      bodySetterRef.current = setter;
    },
    []
  );

  const handleInsertSnippet = useCallback((text: string) => {
    if (bodySetterRef.current) {
      bodySetterRef.current((prev) => {
        if (!prev) return text;
        return prev + "\n\n" + text;
      });
      // Scroll to compose area
      document.getElementById("email-compose")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,240px]">
      <EmailPanel
        activities={activities}
        leadId={leadId}
        leadEmail={leadEmail}
        leadName={leadName}
        leadCompany={leadCompany}
        emailSubjectTag={emailSubjectTag}
        onBodyRef={handleBodyRef}
      />
      {snippets.length > 0 && (
        <div className="hidden lg:block">
          <div className="sticky top-4">
            <EmailSnippetsPanel snippets={snippets} onInsert={handleInsertSnippet} />
          </div>
        </div>
      )}
    </div>
  );
}
