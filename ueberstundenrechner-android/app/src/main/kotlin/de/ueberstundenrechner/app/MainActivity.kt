package de.ueberstundenrechner.app

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        ReminderScheduler.createChannel(this)
        requestRequiredPermissions()

        val w = WebView(this)
        setContentView(w)
        w.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
        }
        w.addJavascriptInterface(AndroidReminderBridge(this), "AndroidReminders")
        w.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse? {
                val c = (r.url.path ?: "").trimStart('/')
                return try {
                    if (c.isEmpty() || c == "index.html") {
                        WebResourceResponse("text/html", "UTF-8", assets.open("index.html"))
                    } else {
                        val mime = when {
                            c.endsWith(".js") -> "application/javascript"
                            c.endsWith(".css") -> "text/css"
                            c.endsWith(".svg") -> "image/svg+xml"
                            c.endsWith(".png") -> "image/png"
                            c.endsWith(".jpg") || c.endsWith(".jpeg") -> "image/jpeg"
                            else -> "application/octet-stream"
                        }
                        WebResourceResponse(mime, "UTF-8", assets.open(c))
                    }
                } catch (_: Exception) {
                    null
                }
            }
        }
        // Load the asset root so the web router resolves the home route "/".
        w.loadUrl("https://appassets.androidplatform.net/")
    }

    private fun requestRequiredPermissions() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 42)
        } else {
            ReminderScheduler.requestExactAlarmAccess(this)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 42) ReminderScheduler.requestExactAlarmAccess(this)
    }
}

class AndroidReminderBridge(private val context: Context) {
    @JavascriptInterface
    fun setVacation(start: Long, end: Long, enabled: Boolean, startFirstDays: Int, startSecondDays: Int, endFirstDays: Int, endSecondDays: Int) {
        ReminderScheduler.setVacation(context, start, end, enabled, startFirstDays, startSecondDays, endFirstDays, endSecondDays)
    }

    @JavascriptInterface
    fun setShiftEnd(end: Long, enabled: Boolean, firstMinutes: Int, secondMinutes: Int) {
        ReminderScheduler.setShiftEnd(context, end, enabled, firstMinutes, secondMinutes)
    }

    @JavascriptInterface
    fun setBreak(end: Long, start: Long, endEnabled: Boolean, startEnabled: Boolean, firstSeconds: Int, secondSeconds: Int, startMinutes: Int) {
        ReminderScheduler.setBreak(context, end, start, endEnabled, startEnabled, firstSeconds, secondSeconds, startMinutes)
    }
}

object ReminderScheduler {
    private const val CHANNEL_ID = "overtime-reminders"
    private const val PREFS = "overtime-reminder-schedule"
    private const val IDS = "scheduled_ids"
    private const val ACTION = "de.ueberstundenrechner.app.REMINDER"
    private const val EXTRA_ID = "id"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_BODY = "body"

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            manager.createNotificationChannel(
                android.app.NotificationChannel(
                    CHANNEL_ID,
                    "Überstunden-Erinnerungen",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                ).apply { description = "Urlaub, Pausen und Schichtende" }
            )
        }
    }

    fun requestExactAlarmAccess(context: Context) {
        if (Build.VERSION.SDK_INT >= 31) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (!alarmManager.canScheduleExactAlarms()) {
                val intent = Intent(
                    android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    android.net.Uri.parse("package:${context.packageName}")
                )
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            }
        }
    }

    fun setVacation(context: Context, start: Long, end: Long, enabled: Boolean, startFirstDays: Int, startSecondDays: Int, endFirstDays: Int, endSecondDays: Int) {
        cancelCategory(context, "vacation-")
        if (!enabled || start <= 0L || end <= start) return
        listOf(
            Triple("start-$startFirstDays", start - startFirstDays * DAY, "Urlaub in ${daysLabel(startFirstDays)}" to "Dein geplanter Urlaub beginnt ${daysLabel(startFirstDays)}."),
            Triple("start-$startSecondDays", start - startSecondDays * DAY, "Urlaub in ${daysLabel(startSecondDays)}" to "Dein geplanter Urlaub beginnt ${daysLabel(startSecondDays)}."),
            Triple("end-$endFirstDays", end - endFirstDays * DAY, "Urlaubsende in ${daysLabel(endFirstDays)}" to "Dein Urlaub endet ${daysLabel(endFirstDays)}."),
            Triple("end-$endSecondDays", end - endSecondDays * DAY, "Urlaubsende in ${daysLabel(endSecondDays)}" to "Dein Urlaub endet ${daysLabel(endSecondDays)}.")
        ).filter { it.second > 0L && it.first.substringAfterLast("-").toIntOrNull()?.let { days -> days > 0 } == true }
            .forEach { (kind, at, copy) ->
                schedule(context, "vacation-$kind-$start-$end", at, copy.first, copy.second)
            }
    }

    fun setShiftEnd(context: Context, end: Long, enabled: Boolean, firstMinutes: Int, secondMinutes: Int) {
        cancelCategory(context, "shift-end-")
        if (!enabled || end <= 0L) return
        listOf(
            firstMinutes to ("Schicht endet in $firstMinutes Minuten" to "Deine geplante Schicht endet bald."),
            secondMinutes to ("Schicht endet in $secondMinutes Minuten" to "Deine geplante Schicht endet gleich.")
        ).filter { it.first > 0 }.distinctBy { it.first }.forEach { (minutes, copy) ->
            schedule(context, "shift-end-$minutes-$end", end - minutes * MINUTE, copy.first, copy.second)
        }
    }

    fun setBreak(context: Context, end: Long, start: Long, endEnabled: Boolean, startEnabled: Boolean, firstSeconds: Int, secondSeconds: Int, startMinutes: Int) {
        cancelCategory(context, "break-")
        if (endEnabled && end > 0L) {
            listOf(firstSeconds, secondSeconds).filter { it > 0 }.distinct().forEach { seconds ->
                schedule(context, "break-end-${seconds}s-$end", end - seconds * SECOND, "Pause endet in $seconds Sekunden", "Deine geplante Pausenzeit ist fast vorbei.")
            }
        }
        if (startEnabled && start > 0L && startMinutes > 0) {
            schedule(context, "break-start-${startMinutes}m-$start", start - startMinutes * MINUTE, "Pause beginnt in $startMinutes Minute${if (startMinutes == 1) "" else "n"}", "Deine geplante Pause beginnt gleich.")
        }
    }

    private fun daysLabel(days: Int) = if (days == 1) "1 Tag" else "$days Tagen"

    fun rescheduleAfterBoot(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val ids = prefs.getStringSet(IDS, emptySet()).orEmpty()
        ids.forEach { id ->
            val alarm = prefs.getLong("$id.time", 0L)
            val title = prefs.getString("$id.title", null)
            val body = prefs.getString("$id.body", null)
            if (alarm > System.currentTimeMillis() && title != null && body != null) {
                schedule(context, id, alarm, title, body)
            }
        }
    }

    private fun schedule(context: Context, id: String, at: Long, title: String, body: String) {
        if (at <= System.currentTimeMillis()) return
        createChannel(context)
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION
            putExtra(EXTRA_ID, id)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_BODY, body)
        }
        val pending = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= 23) {
            if (Build.VERSION.SDK_INT < 31 || alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
            }
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, at, pending)
        }
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val ids = prefs.getStringSet(IDS, emptySet()).orEmpty().toMutableSet().apply { add(id) }
        prefs.edit()
            .putStringSet(IDS, ids)
            .putLong("$id.time", at)
            .putString("$id.title", title)
            .putString("$id.body", body)
            .apply()
    }

    private fun cancelCategory(context: Context, prefix: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val ids = prefs.getStringSet(IDS, emptySet()).orEmpty()
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        ids.filter { it.startsWith(prefix) }.forEach { id ->
            val intent = Intent(context, ReminderReceiver::class.java).apply { action = ACTION }
            val pending = PendingIntent.getBroadcast(
                context, id.hashCode(), intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pending != null) manager.cancel(pending)
        }
        prefs.edit().putStringSet(IDS, ids.filterNot { it.startsWith(prefix) }.toSet()).apply()
    }

    fun notificationId(id: String) = id.hashCode()
    fun channelId() = CHANNEL_ID
    fun reminderId(intent: Intent) = intent.getStringExtra(EXTRA_ID).orEmpty()
    fun reminderTitle(intent: Intent) = intent.getStringExtra(EXTRA_TITLE).orEmpty()
    fun reminderBody(intent: Intent) = intent.getStringExtra(EXTRA_BODY).orEmpty()

    private const val SECOND = 1_000L
    private const val MINUTE = 60_000L
    private const val DAY = 86_400_000L
}
