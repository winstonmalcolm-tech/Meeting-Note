import admin from 'firebase-admin'
import serviceAccount from './firebase_service.json'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  })
}

export const messaging = admin.messaging()
export default admin
