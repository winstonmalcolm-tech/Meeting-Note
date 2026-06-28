import admin from 'firebase-admin'

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as admin.ServiceAccount
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

export const messaging = admin.messaging()
export default admin
