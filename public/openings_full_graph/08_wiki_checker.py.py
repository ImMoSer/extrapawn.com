import json
import chess
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TREE_FILE = os.path.join(BASE_DIR, "opening_wiki.json")

def get_clean_fen(fen: str) -> str:
    """Konvertiert eine volle FEN in den 4-Teile-CleanFEN."""
    try:
        board = chess.Board(fen)
        return " ".join(board.fen().split(' ')[:4])
    except ValueError:
        print("Ungültige FEN.")
        return ""

def load_tree():
    if not os.path.exists(TREE_FILE):
        print(f"Fehler: {TREE_FILE} nicht gefunden.")
        return None
    with open(TREE_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_wiki_path(tree_data, start_id_str):
    """Geht den einzigen vorhandenen Pfad zurück zur Startposition."""
    current_id = start_id_str
    path_moves_uci = []
    
    while current_id != "0":
        node = tree_data["nodes"].get(current_id, {})
        parent_info = node.get("p")
        
        # parent_info ist jetzt ein Array: [parent_id, move_uci]
        if not parent_info: 
            break
            
        parent_id_int, move_uci = parent_info
        path_moves_uci.append(move_uci)
        current_id = str(parent_id_int)
        
    return list(reversed(path_moves_uci))

def format_uci_to_san(uci_moves):
    """Konvertiert UCI Züge in die klassische Buch-Notation (SAN)."""
    board = chess.Board()
    san_parts = []
    
    for i, move_uci in enumerate(uci_moves):
        move = chess.Move.from_uci(move_uci)
        san_move = board.san(move) 
        board.push(move)
        
        if i % 2 == 0:
            move_num = (i // 2) + 1
            san_parts.append(f"{move_num}. {san_move}")
        else:
            san_parts.append(san_move)
            
    return " ".join(san_parts)

def print_forward_tree(tree_data, node_id, current_depth, max_depth, indent="", is_last=True):
    """Druckt alle legalen Theorie-Kinder als ASCII-Baum."""
    if current_depth >= max_depth:
        return

    node = tree_data["nodes"].get(str(node_id), {})
    children = node.get("c", {})

    if not children and current_depth == 0:
        print(f"{indent}  Keine weiteren Theoriezüge in der Datenbank.")
        return

    child_items = list(children.items())
    for i, (move_uci, child_id_int) in enumerate(child_items):
        child_id = str(child_id_int)
        child_node = tree_data["nodes"].get(child_id, {})
        
        c_name_idx = child_node.get("n", -1)
        # Wenn der Knoten einen Namen hat, zeige ihn an
        c_name = f" - {tree_data['names'][c_name_idx]}" if c_name_idx != -1 else ""
        
        is_last_child = (i == len(child_items) - 1)
        connector = "└── " if is_last_child else "├── "
        
        print(f"{indent}{connector}{move_uci}{c_name}")
        
        next_indent = indent + ("    " if is_last_child else "│   ")
        print_forward_tree(tree_data, child_id, current_depth + 1, max_depth, next_indent, is_last_child)

def analyze_fen(tree_data, target_fen, max_depth):
    clean_fen = get_clean_fen(target_fen)
    if not clean_fen: return

    print(f"\nSuche nach Clean FEN: {clean_fen}")
    
    node_id_int = tree_data["fen_map"].get(clean_fen)
    
    if node_id_int is None:
        print("Diese Stellung ist nicht in der Eröffnungsdatenbank vorhanden.")
        return
        
    node_id_str = str(node_id_int)
    node = tree_data["nodes"][node_id_str]
    
    name_idx = node.get("n", -1)
    eco_idx = node.get("e", -1)
    
    name_str = tree_data["names"][name_idx] if name_idx != -1 else "Unbenannte Variante"
    eco_str = tree_data["ecos"][eco_idx] if eco_idx != -1 else "-"
    
    # Wiki-Pfad direkt abrufen (100% sauber, da reiner Baum)
    wiki_uci_path = get_wiki_path(tree_data, node_id_str)
    wiki_san_path = format_uci_to_san(wiki_uci_path)
    
    print("=" * 60)
    print(f"KNOTEN-ID: {node_id_str}")
    print(f"ECO      : {eco_str}")
    print(f"NAME     : {name_str}")
    print(f"WIKI-PFAD: {wiki_san_path}")
    print("=" * 60)
    
    print(f"\n[VORWÄRTS-BAUM] Theoriezüge ab hier (Tiefe: {max_depth}):")
    print_forward_tree(tree_data, node_id_str, 0, max_depth)
    print("\n")

if __name__ == "__main__":
    # --- KONFIGURATION ---
    # FEN der zu analysierenden Stellung (kann beliebig geändert werden)
    TARGET_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
    MAX_DEPTH = 20 
    # ---------------------

    print("Lade reinen Wiki-Baum in den Speicher...")
    tree = load_tree()
    if tree:
        analyze_fen(tree, TARGET_FEN, MAX_DEPTH)