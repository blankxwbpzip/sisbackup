package com.sisbackup.mobile

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class SisbackupApp : Application() {

    companion object {
        const val CHANNEL_SYNC_STATUS = "sync_status"
        const val CHANNEL_ALERTS = "backup_alerts"

        lateinit var instance: SisbackupApp
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channels = listOf(
                NotificationChannel(
                    CHANNEL_SYNC_STATUS,
                    "Status Sinkronisasi",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Notifikasi status backup dan sinkronisasi"
                },
                NotificationChannel(
                    CHANNEL_ALERTS,
                    "Peringatan Backup",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Peringatan penting: backup gagal, kuota penuh, dll."
                }
            )

            val manager = getSystemService(NotificationManager::class.java)
            channels.forEach { manager.createNotificationChannel(it) }
        }
    }
}
