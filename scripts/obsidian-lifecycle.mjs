export const archiveLifecycleRule = Object.freeze({
  id: "obsidian-artifacts-14-days",
  enabled: true,
  conditions: Object.freeze({ prefix: "artifacts/" }),
  deleteObjectsTransition: Object.freeze({
    condition: Object.freeze({ type: "Age", maxAge: 14 * 24 * 60 * 60 }),
  }),
});

const canonical = (value) =>
  JSON.stringify(value, function (_key, item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(
      Object.keys(item)
        .sort()
        .map((key) => [key, item[key]]),
    );
  });

function sameArchiveRule(rule) {
  return (
    rule.enabled === true &&
    rule.conditions?.prefix === archiveLifecycleRule.conditions.prefix &&
    rule.deleteObjectsTransition?.condition?.type === "Age" &&
    rule.deleteObjectsTransition.condition.maxAge ===
      archiveLifecycleRule.deleteObjectsTransition.condition.maxAge &&
    !rule.abortMultipartUploadsTransition &&
    !rule.storageClassTransitions?.length
  );
}

export function planArchiveLifecycle(current) {
  if (!Array.isArray(current?.rules) || current.rules.length > 100)
    throw new Error("R2 lifecycle configuration unavailable");
  const ids = new Set();
  let installed = false;
  for (const rule of current.rules) {
    if (
      typeof rule?.id !== "string" ||
      !rule.id ||
      ids.has(rule.id) ||
      typeof rule.enabled !== "boolean"
    )
      throw new Error("Invalid existing lifecycle rule");
    ids.add(rule.id);
    if (rule.id === archiveLifecycleRule.id) {
      if (!sameArchiveRule(rule))
        throw new Error(
          "Managed archive rule differs; operator review required",
        );
      installed = true;
    }
    if (rule.enabled && rule.deleteObjectsTransition) {
      const prefix = rule.conditions?.prefix,
        condition = rule.deleteObjectsTransition.condition;
      if (
        typeof prefix !== "string" ||
        !prefix.startsWith("artifacts/") ||
        condition?.type !== "Age" ||
        !Number.isSafeInteger(condition.maxAge) ||
        condition.maxAge <
          archiveLifecycleRule.deleteObjectsTransition.condition.maxAge
      )
        throw new Error("Lifecycle would expire retained publication state");
    }
  }
  return {
    changed: !installed,
    rules: [
      ...current.rules,
      ...(installed ? [] : [structuredClone(archiveLifecycleRule)]),
    ],
  };
}

export async function configureArchiveLifecycle(
  client,
  { apply = false } = {},
) {
  const current = await client.read(),
    plan = planArchiveLifecycle(current);
  if (!apply)
    return {
      status: plan.changed ? "configuration-required" : "verified",
      changed: false,
      rule: structuredClone(archiveLifecycleRule),
    };
  if (plan.changed) await client.write({ rules: plan.rules });
  const actual = await client.read(),
    verification = planArchiveLifecycle(actual);
  if (
    verification.changed ||
    actual.rules.length !== plan.rules.length ||
    plan.rules.some(
      (rule) =>
        canonical(actual.rules.find((item) => item.id === rule.id)) !==
        canonical(rule),
    )
  )
    throw new Error(
      "Archive lifecycle readback differs from the planned rules",
    );
  return {
    status: "verified",
    changed: plan.changed,
    rule: structuredClone(archiveLifecycleRule),
  };
}
