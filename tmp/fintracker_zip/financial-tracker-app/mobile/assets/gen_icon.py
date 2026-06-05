"""Generate FinTracker app icon: 1024x1024 PNG."""
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
BG = "#1a1a2e"
ACCENT = "#e94560"
ACCENT_LIGHT = "#ff6b81"
WHITE = "#ffffff"
SUBTLE = "#2a2a4a"

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# --- Rounded rectangle background ---
radius = 200
draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=BG)

# --- Layout constants ---
baseline_y = 740
bar_w = 110
gap = 40
bar_heights = [220, 340, 280, 440, 540]
num_bars = len(bar_heights)
total_w = num_bars * bar_w + (num_bars - 1) * gap
start_x = (SIZE - total_w) // 2

# --- Baseline / x-axis line (draw first, behind everything) ---
draw.line(
    [(start_x - 30, baseline_y), (start_x + total_w + 30, baseline_y)],
    fill=SUBTLE, width=5,
)

# Small tick marks under each bar
for i in range(num_bars):
    cx = start_x + i * (bar_w + gap) + bar_w // 2
    draw.ellipse([cx - 5, baseline_y + 8, cx + 5, baseline_y + 18], fill=SUBTLE)

# --- Bar chart (5 rising bars with gradient effect) ---
for i, h in enumerate(bar_heights):
    x0 = start_x + i * (bar_w + gap)
    y0 = baseline_y - h
    x1 = x0 + bar_w
    y1 = baseline_y
    bar_radius = 18

    # Bar fill: use accent color with slight alpha variation for depth
    # Darker shade for shorter bars, brighter for taller
    brightness = 0.6 + 0.4 * (h / max(bar_heights))
    r_val = int(0xe9 * brightness)
    g_val = int(0x45 * brightness)
    b_val = int(0x60 * brightness)
    bar_color = (r_val, g_val, b_val, 255)

    draw.rounded_rectangle([x0, y0, x1, y1], radius=bar_radius, fill=bar_color)

# --- Trend line (rising, connecting bar tops) ---
line_points = []
for i, h in enumerate(bar_heights):
    cx = start_x + i * (bar_w + gap) + bar_w // 2
    cy = baseline_y - h - 20
    line_points.append((cx, cy))

# Extend line upward-right with arrow
last = line_points[-1]
arrow_tip = (last[0] + 80, last[1] - 60)
line_points.append(arrow_tip)

# Draw the line segments
for j in range(len(line_points) - 1):
    draw.line([line_points[j], line_points[j + 1]], fill=WHITE, width=8)

# Arrow head at end
ax, ay = arrow_tip
arrow_size = 28
draw.polygon([
    (ax + 5, ay - 5),
    (ax - arrow_size + 5, ay - arrow_size),
    (ax - arrow_size - 5, ay + 5),
], fill=WHITE)

# Dots on the line junction points (not arrow tip)
for pt in line_points[:-1]:
    r = 12
    draw.ellipse([pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r], fill=WHITE)
    # Inner dot in accent
    ri = 6
    draw.ellipse([pt[0] - ri, pt[1] - ri, pt[0] + ri, pt[1] + ri], fill=ACCENT)

# --- Dollar coin (top-right area, overlapping the chart) ---
coin_cx = SIZE - 240
coin_cy = 240
coin_r = 100

# Shadow
draw.ellipse(
    [coin_cx - coin_r + 6, coin_cy - coin_r + 6,
     coin_cx + coin_r + 6, coin_cy + coin_r + 6],
    fill=(0, 0, 0, 60),
)

# Outer circle
draw.ellipse(
    [coin_cx - coin_r, coin_cy - coin_r,
     coin_cx + coin_r, coin_cy + coin_r],
    fill=ACCENT, outline=ACCENT_LIGHT, width=6,
)

# Inner ring
inner_r = coin_r - 16
draw.ellipse(
    [coin_cx - inner_r, coin_cy - inner_r,
     coin_cx + inner_r, coin_cy + inner_r],
    outline=ACCENT_LIGHT, width=3,
)

# Dollar sign "$"
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 120)
except OSError:
    font = ImageFont.load_default()

bbox = draw.textbbox((0, 0), "$", font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
tx = coin_cx - tw // 2
ty = coin_cy - th // 2 - bbox[1]
draw.text((tx, ty), "$", fill=WHITE, font=font)

# Save
img.save("/workspace/output/financial-tracker-app/mobile/assets/icon.png", "PNG")
print("Icon saved successfully.")
