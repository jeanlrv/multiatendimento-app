import sys

def search_error(filename):
    lines = []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except UnicodeDecodeError:
        try:
            with open(filename, 'r', encoding='utf-16') as f:
                lines = f.readlines()
        except Exception as e:
            print(f"Error reading file: {e}")
            return

    for i, line in enumerate(lines):
        if "ERROR" in line:
            print(f"-- Error found at line {i+1} --")
            start = max(0, i - 15)  # Increased context before
            end = min(len(lines), i + 25) # Increased context after
            for j in range(start, end):
                print(f"{j+1}: {lines[j].strip()}")
            return # Stop after finding the first error block

if __name__ == "__main__":
    search_error('build_error.log')
