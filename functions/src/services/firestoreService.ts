import * as admin from "firebase-admin";

const db = () => admin.firestore();

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function getPlan(uid: string): Promise<admin.firestore.DocumentData | null> {
  const snap = await db().collection("plans").doc(uid).get();
  return snap.exists ? snap.data() ?? null : null;
}

export async function savePlan(uid: string, plan: unknown): Promise<void> {
  await db().collection("plans").doc(uid).set(plan as admin.firestore.DocumentData);
}

export async function deletePlan(uid: string): Promise<void> {
  await db().collection("plans").doc(uid).delete();
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<admin.firestore.DocumentData | null> {
  const snap = await db().collection("users").doc(uid).get();
  return snap.exists ? snap.data() ?? null : null;
}

export async function upsertUserProfile(
  uid: string,
  data: Record<string, unknown>
): Promise<void> {
  await db().collection("users").doc(uid).set(data, { merge: true });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listAllUsers(limit = 100): Promise<admin.auth.UserRecord[]> {
  const result = await admin.auth().listUsers(limit);
  return result.users;
}

export async function deleteUser(uid: string): Promise<void> {
  await admin.auth().deleteUser(uid);
  await deletePlan(uid);
  await db().collection("users").doc(uid).delete();
}

export async function getStats(): Promise<Record<string, unknown>> {
  const [plansSnap, usersResult] = await Promise.all([
    db().collection("plans").count().get(),
    admin.auth().listUsers(1000),
  ]);

  return {
    totalPlans: plansSnap.data().count,
    totalUsers: usersResult.users.length,
  };
}
