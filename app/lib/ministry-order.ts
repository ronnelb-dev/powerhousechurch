export function validateMinistryOrder(
  submittedIds: unknown,
  currentIds: readonly string[],
): string[] | null {
  if (
    !Array.isArray(submittedIds) ||
    submittedIds.some((id) => typeof id !== "string" || !id) ||
    new Set(submittedIds).size !== submittedIds.length
  ) {
    return null;
  }

  const submitted = submittedIds as string[];
  const currentIdSet = new Set(currentIds);
  if (
    submitted.length !== currentIds.length ||
    submitted.some((id) => !currentIdSet.has(id))
  ) {
    return null;
  }

  return submitted;
}
