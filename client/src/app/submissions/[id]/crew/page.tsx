"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { deleteData, getData, postData } from "@/lib/fetch-util";
import { toast } from "sonner";

type CrewMember = { _id: string; name: string };
type CrewRole = { _id: string; name: string };
type Assignment = { _id: string; submissionId: string; crewMemberId: string; crewRoleId: string };

const CARD = "rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50";
const SECTION_HEADER =
  "px-8 py-6 border-b border-border flex justify-between items-center bg-surface-dark";
const LABEL = "text-accent-foreground text-xs font-bold uppercase tracking-widest";
const INPUT =
  "w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2";

export default function AssignCrewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [members, setMembers] = useState<CrewMember[]>([]);
  const [roles, setRoles] = useState<CrewRole[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const memberMap = useMemo(() => {
    const m = new Map<string, CrewMember>();
    members.forEach((x) => m.set(x._id, x));
    return m;
  }, [members]);
  const roleMap = useMemo(() => {
    const m = new Map<string, CrewRole>();
    roles.forEach((x) => m.set(x._id, x));
    return m;
  }, [roles]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [m, r, a] = await Promise.all([
          getData<{ success: boolean; data: CrewMember[] }>("/crew-members"),
          getData<{ success: boolean; data: CrewRole[] }>("/crew-roles"),
          getData<{ success: boolean; data: Assignment[] }>(
            `/crew-assignments?submissionId=${id}`
          ),
        ]);
        if (!mounted) return;
        if (m?.success) setMembers(m.data || []);
        if (r?.success) setRoles(r.data || []);
        if (a?.success) setAssignments(a.data || []);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const filteredMembers = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [filter, members]);

  // Ensure the select resets when search text changes so the UI reflects results
  useEffect(() => {
    setSelectedMemberId("");
  }, [filter]);

  const addAssignment = async () => {
    if (!selectedMemberId || !selectedRoleId) {
      toast.error("Select a member and a role");
      return;
    }
    if (working) return;
    setWorking(true);
    try {
      const res = await postData<{
        success: boolean;
        data?: Assignment;
        message?: string;
      }>("/crew-assignments", {
        submissionId: id,
        crewMemberId: selectedMemberId,
        crewRoleId: selectedRoleId,
      });
      if (res && (res as any).success && (res as any).data) {
        toast.success("Crew member assigned");
        setAssignments((prev) => [((res as any).data as Assignment), ...prev]);
        setSelectedMemberId("");
        setSelectedRoleId("");
        setFilter("");
      } else {
        toast.error((res as any)?.message || "Failed to assign crew");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to assign crew");
    } finally {
      setWorking(false);
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    if (working) return;
    setWorking(true);
    try {
      const res = await deleteData<{ success: boolean; message?: string }>(
        `/crew-assignments/${assignmentId}`
      );
      if (res && (res as any).success) {
        setAssignments((prev) => prev.filter((x) => x._id !== assignmentId));
        toast.success("Removed");
      } else {
        toast.error((res as any)?.message || "Failed to remove");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove");
    } finally {
      setWorking(false);
    }
  };

  const nextCreate = `/submissions/${id}/crew`;

  return (
    <main className="flex-1 w-full overflow-y-auto px-6 py-10 lg:px-10 scroll-smooth">
      <div className="max-w-6xl mx-auto pb-24">
        <h2 className="text-white text-3xl lg:text-4xl font-serif font-bold leading-tight tracking-wide mb-2">
          Crew & Roles
        </h2>
        <p className="text-[#bab29c] text-lg font-light max-w-2xl mb-6">
          Manage crew for this submission.
        </p>

        {/* Current Assignment */}
        <section className={CARD}>
          <div className={SECTION_HEADER}>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#2a261b] text-[#e2c35a]">🔒</span>
              <h3 className="text-white text-lg font-bold tracking-widest uppercase font-serif">
                Current Assignment
              </h3>
            </div>
            <div className="text-xs uppercase tracking-widest text-[#bab29c]">
              Total Count:{" "}
              <span className="ml-2 inline-flex items-center px-3 py-1 rounded bg-[#2a261b] text-[#e2c35a]">
                {assignments.length} Members
              </span>
            </div>
          </div>
          <div className="divide-y divide-border">
            <div className="grid grid-cols-12 px-6 py-3 text-[#bab29c] text-xs uppercase tracking-widest">
              <div className="col-span-6">Name</div>
              <div className="col-span-4">Role</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            {loading ? (
              <div className="px-6 py-4 text-sm text-muted-foreground">Loading...</div>
            ) : assignments.length === 0 ? (
              <div className="px-6 py-6 text-sm text-muted-foreground">
                No crew assigned yet.
              </div>
            ) : (
              assignments.map((a) => {
                const member = memberMap.get(String(a.crewMemberId));
                const role = roleMap.get(String(a.crewRoleId));
                return (
                  <div
                    key={a._id}
                    className="grid grid-cols-12 px-6 py-4 items-center"
                  >
                    <div className="col-span-6 font-medium text-white">
                      {member?.name ?? "Unknown"}
                    </div>
                    <div className="col-span-4 text-white">
                      {role?.name ?? "Unknown"}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        onClick={() => removeAssignment(a._id)}
                        className="text-red-400 hover:text-red-300"
                        title="Remove"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Add Crew Member */}
        <section className={`${CARD} mt-10`}>
          <div className={SECTION_HEADER}>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#2a261b] text-[#e2c35a]">👥</span>
              <h3 className="text-white text-lg font-bold tracking-widest uppercase font-serif">
                Add Crew Member
              </h3>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className={LABEL}>Crew Member</label>
              <input
                className={INPUT}
                placeholder="Search by name..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <select
                className={INPUT}
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
              >
                <option value="">Select from directory</option>
                {filteredMembers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Not found?{" "}
                <Link
                  className="text-primary underline"
                  href={`/crew/create?next=${encodeURIComponent(nextCreate)}`}
                >
                  Create a new profile
                </Link>
              </p>
            </div>
            <div className="space-y-2">
              <label className={LABEL}>Specific Role</label>
              <select
                className={INPUT}
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
              >
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-start md:justify-end mt-4">
                <button
                  onClick={addAssignment}
                  disabled={working}
                  className="px-6 py-3 rounded bg-primary text-black hover:bg-[#d9a50b] font-bold uppercase tracking-widest text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {working ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

