Hier ist die Übersicht über die Implementierung und Funktionsweise:

1. Wo ist die Logik definiert?
   Die gesamte Logik befindet sich im Feature-Verzeichnis:
   src/features/study-reply-training/

Die wichtigsten Dateien sind:

- model/RepertoireTrainingStrategy.ts: Enthält die Kernlogik des Trainings. Sie steuert, wie das System auf Nutzerzüge reagiert, wie Züge validiert werden und was am Ende einer Variante passiert.
- lib/SrsService.ts: Implementiert das Spaced Repetition System (SRS). Hier wird berechnet, welche Varianten "fällig" sind (der sogenannte "Weed Pressure" Algorithmus).
- model/reply-training.store.ts: Der Pinia-Store, der den Zustand der aktuellen Trainings-Session (Statistiken, Aktivitätsstatus) verwaltet.

2. Verantwortliche Module
   Das Training ist nach dem Feature-Sliced Design (FSD) aufgebaut und interagiert mit folgenden Modulen:

- entities/game: Stellt die Infrastruktur für das Schachbrett und die Spielstrategien bereit (IGameplayStrategy).
- entities/study: Liefert die Daten der Chapters und speichert den Trainingsfortschritt (Mastery) in den Metadaten der PGN-Knoten.
- shared/lib/pgn: Wird intensiv genutzt, um durch den Variantenbaum zu navigieren und zu prüfen, ob ein Nutzerzug Teil des Repertoires ist.

3. Wie funktioniert das Reply-Training?
   Das System nutzt eine "Weed Pressure" (Unkraut-Druck) Metapher, um den Lernprozess zu steuern:

1. Strategische Auswahl (SrsService):
   - Das System betrachtet die Endknoten (Leafs) deiner Varianten.
   - Jede Variante hat einen Wert für Mastery (Beherrschung) und Last Trained (zuletzt trainiert).
   - Je länger ein Training her ist oder je öfter Fehler gemacht wurden, desto höher ist der "Weed Pressure".
   - Der Bot wählt an Abzweigungen immer den Weg, der zu den "verunkrauteten" (schlecht beherrschten) Stellen führt, um diese gezielt zu trainieren.

1. Validierung der Züge:
   - Wenn du einen Zug machst, prüft die RepertoireTrainingStrategy, ob dieser Zug im aktuellen PGN-Baum als Kindknoten existiert.
   - Richtig: Der Zug wird ausgeführt, die Statistik correct erhöht sich.
   - Falsch: Ein Fehlersound ertönt, die Statistik wrong erhöht sich, und der Zug wird als Fehler markiert.

1. Berechnung der Mastery:
   - Am Ende einer Variante wird die Mastery des Knotens aktualisiert:
     Mastery = 0.5 _ (1.0 - Fehlerrate) + 0.5 _ alte_Mastery
   - Dies sorgt dafür, dass sich die Beherrschung einer Variante über Zeit stabilisiert oder bei Fehlern schnell sinkt.

1. Session-Ablauf:
   - Nachdem eine Variante abgeschlossen ist, wird kurz gewartet, das Brett auf die Startposition des Chapters zurückgesetzt und der Bot startet (falls nötig) die nächste Herausforderung.
   - Du siehst währenddessen Statistiken über deine Genauigkeit (Accuracy) und wie viele Varianten du in der aktuellen Sitzung bereits fehlerfrei gelöst hast.

Zusammenfassend ist es ein intelligentes Repetitions-System, das dich automatisch immer dort prüft, wo deine Kenntnisse am schwächsten sind.
