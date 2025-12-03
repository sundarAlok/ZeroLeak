# Cloud Functions (sample)

This folder contains sample Firebase Cloud Functions to reliably maintain `unreadCounts` on `conversations`.

How it works:
- `onMessageCreate`: triggered when a new message document is created under `conversations/{convoId}/messages/{messageId}`. It increments `unreadCounts.<userId>` for every participant other than the sender and updates `lastMessage` and `lastMessageTime` atomically.
- `onMessageUpdate`: listens for message updates (for example when `readBy` changes) and zeroes `unreadCounts.<uid>` when all messages are read by that user.

Deployment:
1. Install Firebase CLI and login: `npm i -g firebase-tools` then `firebase login`.
2. From this `functions` folder, run `npm install`.
3. Deploy with: `firebase deploy --only functions`.

Notes:
- These samples use the Admin SDK and require the project to be set up in your Firebase project.
- Deploying functions will incur costs when run at scale; test in a dev project first.
