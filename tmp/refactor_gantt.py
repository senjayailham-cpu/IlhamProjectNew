with open('src/components/GanttGrid.tsx', 'r') as f:
    lines = f.readlines()

start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if 'key={`row-left-${row.id}-${idx}`}' in line:
        # find the opening >
        for j in range(i, i + 10):
            if lines[j].strip() == '>':
                start_idx = j + 1
                break
        if start_idx:
            # find the closing </div> of this row
            for k in range(start_idx, len(lines)):
                if lines[k].strip() == '</div>' and lines[k+1].strip() == ');':
                    end_idx = k
                    break
        break

print(f"Found start_idx={start_idx}, end_idx={end_idx}")
if start_idx is not None and end_idx is not None:
    print(f"Replacing lines {start_idx} to {end_idx}")
    print(f"Sample before: {lines[start_idx].strip()}")
    print(f"Sample end: {lines[end_idx].strip()}")
    new_content = lines[:start_idx] + ['              {activeColumns.map(colId => renderColumnCell(colId, row, idx, rowConflicts, !!hasConflict))}\n'] + lines[end_idx:]
    with open('src/components/GanttGrid.tsx', 'w') as f:
        f.writelines(new_content)
    print("SUCCESS")
else:
    print("FAILED TO FIND INDICES")
