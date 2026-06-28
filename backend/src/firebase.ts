import admin from 'firebase-admin'

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set')

  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

export const messaging = admin.messaging()
export default admin
