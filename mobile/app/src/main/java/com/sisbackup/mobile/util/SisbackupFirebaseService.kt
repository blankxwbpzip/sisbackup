package com.sisbackup.mobile.util

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.sisbackup.mobile.MainActivity
import com.sisbackup.mobile.R
import com.sisbackup.mobile.SisbackupApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Firebase Cloud Messaging service untuk push notification
 *
 * Menangani notifikasi dari Siscloud:
 * - Sync completed/failed
 * - Quota warning
 * - Conflict detected
 * - New share received
 */
class SisbackupFirebaseService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Register token with Siscloud
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val api = com.sisbackup.mobile.api.ApiClientBuilder.create()
                api.registerPushToken(
                    com.sisbackup.mobile.api.PushTokenRequest(token)
                )
            } catch (_: Exception) {
                // Will retry on next app launch
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title
            ?: message.data["title"]
            ?: "Sisbackup"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: "Update backup tersedia"
        val type = message.data["type"] ?: "info"

        val channelId = when (type) {
            "backup_failed", "quota_full", "conflict" -> SisbackupApp.CHANNEL_ALERTS
            else -> SisbackupApp.CHANNEL_SYNC_STATUS
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(
                if (channelId == SisbackupApp.CHANNEL_ALERTS)
                    NotificationCompat.PRIORITY_HIGH
                else
                    NotificationCompat.PRIORITY_DEFAULT
            )
            .setContentIntent(pendingIntent)
            .build()

        val notificationId = System.currentTimeMillis().toInt()
        NotificationManagerCompat.from(this).notify(notificationId, notification)
    }
}
