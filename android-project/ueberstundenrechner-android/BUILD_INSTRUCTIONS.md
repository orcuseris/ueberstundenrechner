# Überstundenrechner Android

Android-Studio-Projekt mit nativen Benachrichtigungen, frei einstellbaren Vorlaufzeiten und einer Bestätigung vor dem Beenden der Schicht.

## Öffnen und bauen

1. Dieses Verzeichnis in Android Studio öffnen.
2. Als Gradle JVM **JDK/JBR 21** auswählen.
3. Gradle synchronisieren lassen.
4. Auf einem Android-Gerät oder Emulator starten.
5. Beim ersten Start Benachrichtigungen erlauben.
6. Falls Android die Seite für exakte Alarme öffnet, „Zulassen“ aktivieren.

Die Vorlaufzeiten werden in der App unter **Einstellungen → Erinnerungen** gesetzt. Der Wert 0 deaktiviert den jeweiligen Hinweis. Vor dem Speichern einer Schicht erscheint eine Bestätigung, damit ein versehentlicher Klick auf „Schicht beenden“ nicht sofort beendet.

Die Erinnerungen laufen nativ über Android AlarmManager, nicht über Browser-Benachrichtigungen. Bereits ausgelöste Erinnerungen werden dauerhaft markiert und ausstehende Alarme nach einem Geräte-Neustart wiederhergestellt.
