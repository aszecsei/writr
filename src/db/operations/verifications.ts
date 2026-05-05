import { db } from "../database";
import { type Verification, VerificationSchema } from "../schemas";
import { generateId, now } from "./helpers";

export type CreateVerificationInput = Omit<Verification, "id" | "createdAt">;

export async function createVerification(
  input: CreateVerificationInput,
): Promise<Verification> {
  const verification = VerificationSchema.parse({
    id: generateId(),
    ...input,
    createdAt: now(),
  });
  await db.verifications.add(verification);
  return verification;
}

export async function getVerification(
  id: string,
): Promise<Verification | undefined> {
  return db.verifications.get(id);
}

export async function listVerificationsByRun(
  runId: string,
): Promise<Verification[]> {
  return db.verifications.where({ runId }).sortBy("createdAt");
}

export async function listVerificationsByTier(
  runId: string,
  tier: number,
): Promise<Verification[]> {
  return db.verifications
    .where("[runId+tier]")
    .equals([runId, tier])
    .sortBy("createdAt");
}

export async function deleteVerification(id: string): Promise<void> {
  await db.verifications.delete(id);
}
