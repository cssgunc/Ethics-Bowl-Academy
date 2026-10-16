/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from "firebase-admin";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

admin.initializeApp();

// Module CRUD operations

// Step CRUD operations

// User progress operations

// Query Helper (getPublicModules, getUserModules, etc.)

// Debate session operations
// Debate Functions use createDebateSession/updateDebateSession from
// "./debateSessions" after verifying the caller's UID and module access.
