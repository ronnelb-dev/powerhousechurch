export type AttendanceStatus = "PRESENT" | "ABSENT";
export type AttendanceStatusFilter = "ALL" | AttendanceStatus | "UNMARKED";
export type AttendanceMap = Record<string, AttendanceStatus>;
export type AttendanceListMember = {
  id: string;
  firstName: string;
  lastName: string;
};

type PendingSubmission = {
  formData?: FormData;
};

export function projectAttendanceMap(
  attendanceMap: AttendanceMap,
  submissions: PendingSubmission[],
): AttendanceMap {
  const projected = { ...attendanceMap };

  for (const submission of submissions) {
    const formData = submission.formData;
    if (!formData) continue;
    const intent = String(formData.get("intent") ?? "");

    if (intent === "markAttendance") {
      const userId = String(formData.get("userId") ?? "");
      const status = String(formData.get("status") ?? "");
      if (userId && (status === "PRESENT" || status === "ABSENT")) {
        projected[userId] = status;
      }
      continue;
    }

    if (intent === "clearAttendance") {
      delete projected[String(formData.get("userId") ?? "")];
      continue;
    }

    const userIds = formData.getAll("userIds").map(String);
    if (intent === "bulkMarkPresent" || intent === "bulkMarkAbsent") {
      const status = intent === "bulkMarkPresent" ? "PRESENT" : "ABSENT";
      userIds.forEach((userId) => {
        projected[userId] = status;
      });
    } else if (intent === "bulkClearAttendance") {
      userIds.forEach((userId) => {
        delete projected[userId];
      });
    }
  }

  return projected;
}

export function filterAttendanceMembers(
  members: AttendanceListMember[],
  attendanceMap: AttendanceMap,
  query: string,
  statusFilter: AttendanceStatusFilter,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("en");

  return members.filter((member) => {
    const matchesQuery =
      !normalizedQuery ||
      `${member.firstName} ${member.lastName}`
        .toLocaleLowerCase("en")
        .includes(normalizedQuery);
    if (!matchesQuery) return false;

    const status = attendanceMap[member.id];
    if (statusFilter === "ALL") return true;
    if (statusFilter === "UNMARKED") return status === undefined;
    return status === statusFilter;
  });
}

export function pruneSelectedIds(
  selectedIds: string[],
  visibleMembers: AttendanceListMember[],
) {
  const visibleIds = new Set(visibleMembers.map((member) => member.id));
  return selectedIds.filter((id) => visibleIds.has(id));
}
