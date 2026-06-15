import { readFileSync } from "node:fs";
import { join } from "node:path";
import admin from "firebase-admin";

const serviceAccountPath = join(__dirname, "../../firebase-service-account.json");

function initializeFirebaseAdmin(): typeof admin {
  if (admin.apps.length > 0) {
    return admin;
  }

  const rawServiceAccount = readFileSync(serviceAccountPath, "utf8");
  const serviceAccount = JSON.parse(rawServiceAccount) as admin.ServiceAccount;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}

export const firebaseAdmin = initializeFirebaseAdmin();
