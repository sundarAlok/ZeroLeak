# Unread Counter Cloud Function

This example Cloud Function increments a per-user `unreadCounts` map on the parent `conversations/{convoId}` document whenever a new message is created in the `messages` subcollection.

How it works:
- Trigger: `onCreate` for `conversations/{convoId}/messages/{messageId}`
- It reads the conversation participants and increments `unreadCounts.<participantId>` for every participant except the message sender.
- Also updates `lastMessage` and `lastMessageTime` atomically with the increments.

To deploy:
1. Install Firebase CLI and log in:

```bash
npm install -g firebase-tools
firebase login
```

2. From this directory (or move the function code into your Firebase functions folder), install deps and deploy:

```bash
cd functions/unread-counter
npm install
firebase deploy --only functions:onMessageCreateIncrementUnread
```

Notes:
- Make sure the `conversations` documents contain a `participants` array.
- Consider adding error handling and idempotency logic depending on your app needs.
