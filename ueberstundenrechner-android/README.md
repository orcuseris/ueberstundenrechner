# Überstundenrechner Android

Eine Android-App zur Erfassung von Arbeitszeit, Pausen und Überstunden. Die App enthält einen Live-Timer, eine Urlaubsvorschau und native Android-Erinnerungen, die auch nach einem App-Neustart erhalten bleiben.

## Funktionen

- Arbeitszeit-Timer mit Start, Pause, Fortsetzen und Beenden
- Pausen-Timer mit geplanter Pausenlänge
- Überstundenberechnung nach wählbaren Arbeitszeitregeln für Deutschland, Österreich und die Schweiz
- Unterstützung für normale Arbeitszeit und Gleitzeit
- Eingabe bereits aufgebauter Überstunden mit lokal gespeichertem Gesamtsaldo
- Schichtfortschritt direkt unter dem Timer
- Eigene Wochenend-Nettoarbeitszeit einstellbar; sie steuert Überstunden, Fortschritt und Schichtende-Erinnerung
- Kennzeichnung von Wochenendschichten im Schichtverlauf
- Verlauf abgeschlossener Schichten
- Urlaub-Countdown:
  - Zeit bis zum Urlaubsbeginn
  - verbleibende Zeit während des Urlaubs
  - frei einstellbare Erinnerungen vor Beginn und Ende
- Feiertagskalender für:
  - alle 16 deutschen Bundesländer
  - alle 9 österreichischen Bundesländer
  - alle 26 Schweizer Kantone
- Countdown bis zum nächsten regionalen Feiertag
- Anzeige, ob ein Feiertag auf einen Samstag oder Sonntag fällt
- Feiertagsliste nach ausgewählter Region
- Einklappbarer Feiertags- und Brückentagsbereich
- Länderauswahl für die Arbeitszeitregeln:
  - Deutschland: ArbZG-Pausenstaffel und 10 Stunden Tagesmaximum
  - Österreich: AZG-Pausenregel und 12 Stunden Tagesmaximum
  - Schweiz: abgestufte Pausen nach Arbeitsgesetz und 14 Stunden Tagesmaximum
- FAQ-Erklärung der aktiven gesetzlichen Berechnungsgrundlage
- FAQ zu Überstundensaldo und Wochenendschichten
- Native Android-Benachrichtigungen für:
  - Urlaub
  - Pausenbeginn
  - Pausenende
  - Schichtende
- Frei einstellbare Vorlaufzeiten
- Jede Erinnerung wird pro Ereignis nur einmal ausgelöst
- Ausstehende Erinnerungen werden nach einem Geräte-Neustart wiederhergestellt
- Bestätigungsdialog vor dem Beenden einer Schicht, um Fehlklicks zu verhindern
- Dark Mode
- Speicherung der Einstellungen auf dem Gerät

## Voraussetzungen

- Android Studio
- Android SDK 35
- JDK/JBR 21
- Gradle 8.6
- Android-Gerät oder Emulator mit Android 8.0 (API 26) oder höher

## Projekt öffnen

1. Repository klonen oder ZIP-Datei entpacken:

   ```bash
   git clone <REPOSITORY_URL>
   cd ueberstundenrechner-android
   ```

2. Den Projektordner in Android Studio öffnen.
3. Unter **Settings → Build, Execution, Deployment → Build Tools → Gradle** als Gradle JVM **JDK/JBR 21** auswählen.
4. Auf **Sync Project with Gradle Files** klicken.
5. Die App auf einem Emulator oder angeschlossenen Android-Gerät starten.

## Build über die Kommandozeile

Unter Windows:

```bat
gradlew.bat assembleDebug
```

Unter macOS oder Linux:

```bash
./gradlew assembleDebug
```

Die Debug-APK wird anschließend normalerweise hier abgelegt:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Benachrichtigungen aktivieren

Beim ersten Start benötigt die App Berechtigungen für:

1. **Benachrichtigungen**
2. **Exakte Alarme / Alarme und Erinnerungen**

Diese Berechtigungen sind notwendig, damit kurze Pausenerinnerungen und zeitgenaue Schicht-Erinnerungen zuverlässig funktionieren.

Falls keine Benachrichtigung erscheint, prüfe:

```text
Android-Einstellungen
→ Apps
→ Überstundenrechner
→ Benachrichtigungen
```

Zusätzlich kann je nach Android-Version folgende Einstellung erforderlich sein:

```text
Android-Einstellungen
→ Apps
→ Besonderer App-Zugriff
→ Alarme und Erinnerungen
```

Die App verwendet **native Android-Benachrichtigungen** und keine Browser-Benachrichtigungen.

## Erinnerungsintervalle konfigurieren

Die Vorlaufzeiten befinden sich in der App unter:

```text
Einstellungen → Erinnerungen → Eigene Vorlaufzeiten
```

Unterstützte Werte:

- Urlaub beginnt: zwei frei wählbare Tageswerte
- Urlaubsende: zwei frei wählbare Tageswerte
- Pausenende: zwei frei wählbare Sekundenwerte
- Pausenbeginn: ein frei wählbarer Minutenwert
- Schichtende: zwei frei wählbare Minutenwerte

Der Wert `0` deaktiviert den jeweiligen Hinweis. Die Erinnerungen werden für jedes konkrete Ereignis nur einmal gesendet.

## Technischer Aufbau

- Kotlin Android-App
- Android WebView für die Benutzeroberfläche
- Gradle 8.6
- Android Gradle Plugin 8.3
- Kotlin 1.9
- Android `AlarmManager` für lokale, zeitgesteuerte Erinnerungen
- `BroadcastReceiver` zum Anzeigen der Benachrichtigungen
- `BootReceiver` zur Wiederherstellung ausstehender Alarme nach einem Neustart
- `SharedPreferences` für lokale Timer-, Alarm- und Statusdaten

Die Benutzeroberfläche wird als gebündelte Web-App in den Android-App-Assets ausgeliefert. Die Kommunikation zwischen WebView und nativer Android-Schicht erfolgt über eine sichere, lokale JavaScript-Schnittstelle.

## Datenschutz

Die App speichert Timer, Einstellungen, Verlauf und Erinnerungsstatus lokal auf dem Gerät. Es werden für die Kernfunktionen keine Benutzerkonten und keine externe Serververbindung benötigt.

## Hinweise

Die Feiertage werden anhand des ausgewählten Landes und der ausgewählten Region lokal berechnet. Bei regionalen Sonderregelungen auf Gemeindeebene kann es zusätzliche Abweichungen geben.