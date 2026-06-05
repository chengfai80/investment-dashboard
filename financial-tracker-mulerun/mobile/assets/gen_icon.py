from PIL import Image, ImageDraw
import math

SIZE = 1024
BG_COLOR = (26, 26, 46)        # #1a1a2e
ACCENT = (233, 69, 96)         # #e94560
BAR_BASE = (58, 58, 90)        # muted navy for bar base
BAR_HIGHLIGHT = (233, 69, 96)  # accent for bars
WHITE = (255, 255, 255)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# --- Rounded rectangle background ---
RADIUS = 180
draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=RADIUS, fill=BG_COLOR)

# --- Bar chart ---
# Define bar positions and heights (ascending trend)
margin_left = 200
margin_bottom = 680
bar_width = 90
bar_gap = 45
bar_heights = [180, 260, 220, 340, 430]

bars = []
for i, h in enumerate(bar_heights):
    x0 = margin_left + i * (bar_width + bar_gap)
    y0 = margin_bottom - h
    x1 = x0 + bar_width
    y1 = margin_bottom
    bars.append((x0, y0, x1, y1))

    # Draw bar with rounded top corners
    r = 20
    # Main body
    draw.rectangle([x0, y0 + r, x1, y1], fill=BAR_BASE)
    # Top rounded part
    draw.rounded_rectangle([x0, y0, x1, y0 + 2 * r], radius=r, fill=BAR_BASE)

# --- Upward trend line (accent color) ---
# Line goes through roughly the top-center of each bar, with an upward trend
points = []
for i, (x0, y0, x1, y1) in enumerate(bars):
    cx = (x0 + x1) / 2
    cy = y0 + 10  # slightly inside the top of bar
    points.append((cx, cy))

# Offset the line upward a bit for visual clarity
line_points = [(x, y - 40) for x, y in points]

# Draw thick trend line
LINE_WIDTH = 14
for i in range(len(line_points) - 1):
    draw.line([line_points[i], line_points[i + 1]], fill=ACCENT, width=LINE_WIDTH)

# Draw dots at each point
DOT_R = 18
for px, py in line_points:
    draw.ellipse([px - DOT_R, py - DOT_R, px + DOT_R, py + DOT_R], fill=ACCENT)

# --- Arrowhead at the end of the trend line ---
end_x, end_y = line_points[-1]
prev_x, prev_y = line_points[-2]

# Direction vector
dx = end_x - prev_x
dy = end_y - prev_y
length = math.sqrt(dx * dx + dy * dy)
dx /= length
dy /= length

arrow_len = 50
arrow_width = 30

tip_x = end_x + dx * arrow_len
tip_y = end_y + dy * arrow_len

# Perpendicular
px = -dy
py = dx

left_x = end_x + px * arrow_width
left_y = end_y + py * arrow_width
right_x = end_x - px * arrow_width
right_y = end_y - py * arrow_width

draw.polygon([(tip_x, tip_y), (left_x, left_y), (right_x, right_y)], fill=ACCENT)

# --- Subtle baseline ---
base_y = margin_bottom + 15
draw.line([(margin_left - 30, base_y), (bars[-1][2] + 40, base_y)], fill=(80, 80, 120), width=6)

# --- Small accent glow circles (decorative, behind bars) ---
# Add subtle white-ish circles for depth
for i, (x0, y0, x1, y1) in enumerate(bars):
    cx = (x0 + x1) / 2
    glow_r = 6
    draw.ellipse([cx - glow_r, y1 - glow_r - 2, cx + glow_r, y1 + glow_r - 2],
                 fill=(100, 100, 140, 80))

img.save("/workspace/output/financial-tracker-app/mobile/assets/icon.png", "PNG")
print("Icon saved successfully.")
