"use client";

import { useState, useTransition } from "react";
import { addSkillToUser, removeSkillFromUser, createSkill } from "./actions";

type Skill = { id: string; name: string };

export default function SkillEditor({
  userId,
  allSkills,
  userSkillIds,
}: {
  userId: string;
  allSkills: Skill[];
  userSkillIds: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [newSkillName, setNewSkillName] = useState("");
  const [open, setOpen] = useState(false);

  function handleToggle(skillId: string, checked: boolean) {
    startTransition(async () => {
      if (checked) {
        await addSkillToUser(userId, skillId);
      } else {
        await removeSkillFromUser(userId, skillId);
      }
    });
  }

  function handleCreateSkill() {
    if (!newSkillName.trim()) return;
    startTransition(async () => {
      await createSkill(newSkillName.trim());
      setNewSkillName("");
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-zinc-400 hover:text-zinc-200"
      >
        Editar skills
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">Skills</span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cerrar
        </button>
      </div>

      <div className="space-y-1">
        {allSkills.map((skill) => (
          <label
            key={skill.id}
            className="flex items-center gap-2 rounded px-1 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700/50"
          >
            <input
              type="checkbox"
              checked={userSkillIds.includes(skill.id)}
              onChange={(e) => handleToggle(skill.id, e.target.checked)}
              disabled={isPending}
              className="rounded border-zinc-600 bg-zinc-700 text-green-500 focus:ring-green-500/30"
            />
            {skill.name}
          </label>
        ))}
      </div>

      <div className="flex gap-1 pt-1">
        <input
          type="text"
          value={newSkillName}
          onChange={(e) => setNewSkillName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateSkill()}
          placeholder="Nuevo skill..."
          disabled={isPending}
          className="flex-1 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-green-500 focus:outline-none"
        />
        <button
          onClick={handleCreateSkill}
          disabled={isPending || !newSkillName.trim()}
          className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          +
        </button>
      </div>
    </div>
  );
}
