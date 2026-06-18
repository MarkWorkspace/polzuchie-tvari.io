import json
import sys

def analyze_trace(filepath):
    print("Loading trace...")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    events = data.get("traceEvents", data) if isinstance(data, dict) else data
    
    print(f"Total events: {len(events)}")
    
    long_events = []
    for e in events:
        if "dur" in e and e["dur"] > 10000: # > 10ms
            long_events.append(e)
            
    long_events.sort(key=lambda x: x["dur"], reverse=True)
    
    print("Top 20 longest events:")
    for e in long_events[:20]:
        dur_ms = e["dur"] / 1000.0
        name = e.get("name", "Unknown")
        args = e.get("args", {})
        tid = e.get("tid", "Unknown")
        print(f"[{tid}] {name} - {dur_ms:.2f}ms (Args: {args})")

if __name__ == "__main__":
    analyze_trace(sys.argv[1])
