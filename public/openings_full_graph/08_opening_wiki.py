import pandas as pd
from datasets import load_dataset
import chess
import json
import time
import os

# --- Konfiguration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "opening_wiki.json")

def get_clean_fen(board: chess.Board) -> str:
    """Gibt den FEN ohne Halb-/Vollzugzähler zurück."""
    return " ".join(board.fen().split(' ')[:4])

def build_wiki_tree():
    try:
        print("Lade Dataset...")
        start_time = time.time()
        dataset = load_dataset("Lichess/chess-openings", split="train")
        df = dataset.to_pandas()
        
        # TRICK: Wir sortieren das Dataset nach der Anzahl der Züge.
        # Dadurch wird der kürzeste (und meist kanonische) Weg zu einer Stellung
        # immer als Erster verarbeitet und wird zum ultimativen Wiki-Pfad.
        df['move_count'] = df['uci'].apply(lambda x: len(x.split()))
        df = df.sort_values('move_count')
        
        print(f"Dataset geladen und sortiert in {time.time() - start_time:.2f}s")

        names_list = []
        names_map = {}
        ecos_list = []
        ecos_map = {}

        def get_idx(val: str, lst: list, mp: dict) -> int:
            if not val: return -1
            if val not in mp:
                mp[val] = len(lst)
                lst.append(val)
            return mp[val]

        fen_to_id = {}
        # Graph Struktur für den Baum:
        # p ist jetzt KEIN Dictionary mehr, sondern ein Array: [parent_id, move_uci]
        # p ist null für die Startposition
        nodes = {} 

        board = chess.Board()
        start_fen = get_clean_fen(board)
        
        fen_to_id[start_fen] = 0
        nodes[0] = { "n": -1, "e": -1, "c": {}, "p": None }

        print("Baue strikten Wiki-Baum...")
        tree_start = time.time()
        
        ignored_transpositions = 0

        for uci_str, name, eco in zip(df['uci'], df['name'], df['eco']):
            moves = uci_str.split()
            if not moves: continue
            
            board.reset()
            curr_id = 0
            
            for i, move_uci in enumerate(moves):
                board.push(chess.Move.from_uci(move_uci))
                next_fen = get_clean_fen(board)
                
                # Ist das eine völlig neue Stellung?
                if next_fen not in fen_to_id:
                    next_id = len(fen_to_id)
                    fen_to_id[next_fen] = next_id
                    
                    # Knoten erstellen mit exakt EINEM Parent
                    nodes[next_id] = { 
                        "n": -1, 
                        "e": -1, 
                        "c": {}, 
                        "p": [curr_id, move_uci] 
                    }
                    # Beim aktuellen Knoten als Kind eintragen
                    nodes[curr_id]["c"][move_uci] = next_id
                    
                else:
                    # Stellung existiert bereits!
                    next_id = fen_to_id[next_fen]
                    
                    # Wenn wir hier über einen neuen Weg angekommen sind, 
                    # ignorieren wir diese Kante streng (wir wollen ja keine Transpositionen!)
                    if move_uci not in nodes[curr_id]["c"] or nodes[curr_id]["c"][move_uci] != next_id:
                        ignored_transpositions += 1
                
                # Name und ECO zuweisen, wenn wir am Ende der Zeile sind
                if i == len(moves) - 1:
                    n_idx = get_idx(name, names_list, names_map)
                    e_idx = get_idx(eco, ecos_list, ecos_map)
                    
                    if nodes[next_id]["n"] == -1:
                        nodes[next_id]["n"] = n_idx
                    if nodes[next_id]["e"] == -1:
                        nodes[next_id]["e"] = e_idx
                        
                # Weitergehen in der Linie
                curr_id = next_id

        print(f"Baum fertig. Knoten: {len(nodes)}. Zeit: {time.time() - tree_start:.2f}s")
        print(f"Abgeschnittene Transpositions-Kanten: {ignored_transpositions}")

        # --- Speichern ---
        out_data = {
            "names": names_list,
            "ecos": ecos_list,
            "root_id": 0,
            "fen_map": fen_to_id,
            "nodes": nodes
        }
        
        print(f"Speichere in {OUTPUT_FILE}...")
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(out_data, f, ensure_ascii=False, separators=(',', ':'))
            
        print("Erfolgreich beendet! Du hast jetzt einen reinen Eröffnungs-Baum.")

    except Exception as e:
        print(f"Fehler: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    build_wiki_tree()