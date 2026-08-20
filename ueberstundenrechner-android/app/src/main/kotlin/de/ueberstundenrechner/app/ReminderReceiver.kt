package de.ueberstundenrechner.app

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = ReminderScheduler.reminderId(intent)
        if (id.isBlank()) return

        val sentPrefs = context.getSharedPreferences("overtime-reminder-sent", Context.MODE_PRIVATE)
        if (sentPrefs.getBoolean(id, false)) return

        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        ReminderScheduler.createChannel(context)
        val openApp = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, ReminderScheduler.channelId())
            .setSmallIcon(de.ueberstundenrechner.app.R.mipmap.ic_launcher)
            .setContentTitle(ReminderScheduler.reminderTitle(intent))
            .setContentText(ReminderScheduler.reminderBody(intent))
            .setStyle(NotificationCompat.BigTextStyle().bigText(ReminderScheduler.reminderBody(intent)))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openApp)
            .build()
        NotificationManagerCompat.from(context).notify(ReminderScheduler.notificationId(id), notification)
        sentPrefs.edit().putBoolean(id, true).apply()
    }
}