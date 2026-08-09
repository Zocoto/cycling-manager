from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw


WIDTH = 320
HEIGHT = 240
SCALE = 2
FRAME_COUNT = 24
OUTPUT_DIRECTORY = Path("public/images/chat/reactions")

INK = "#0B302B"
GREEN = "#176951"
MINT = "#72D4B7"
YELLOW = "#F2C94C"
CORAL = "#E96C52"
CREAM = "#FFF8E7"
SKY = "#DDEEE6"
ROAD = "#5E6965"
ROAD_LIGHT = "#87928D"
BLUE = "#4E8FD3"
SKIN = "#B98261"
WHITE = "#FFFFFF"


def px(value: float) -> int:
    return round(value * SCALE)


def point(x: float, y: float) -> tuple[int, int]:
    return px(x), px(y)


def ease(value: float) -> float:
    bounded = max(0.0, min(1.0, value))
    return bounded * bounded * (3 - 2 * bounded)


def segment(value: float, start: float, end: float) -> float:
    if end <= start:
        return 0
    return ease((value - start) / (end - start))


def line(
    draw: ImageDraw.ImageDraw,
    coordinates: list[tuple[float, float]],
    fill: str,
    width: float,
) -> None:
    draw.line(
        [point(x, y) for x, y in coordinates],
        fill=fill,
        width=px(width),
        joint="curve",
    )


def ellipse(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    fill: str | None,
    outline: str | None = None,
    width: float = 1,
) -> None:
    draw.ellipse(
        tuple(px(value) for value in box),
        fill=fill,
        outline=outline,
        width=px(width),
    )


def polygon(
    draw: ImageDraw.ImageDraw,
    coordinates: list[tuple[float, float]],
    fill: str,
    outline: str | None = None,
    width: float = 1,
) -> None:
    points = [point(x, y) for x, y in coordinates]
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(
            points + [points[0]],
            fill=outline,
            width=px(width),
            joint="curve",
        )


def draw_background(
    draw: ImageDraw.ImageDraw,
    phase: float,
    speed: float = 1,
    finish_x: float | None = None,
    feed_zone: bool = False,
) -> None:
    draw.rectangle((0, 0, px(WIDTH), px(HEIGHT)), fill=SKY)
    ellipse(draw, (247, 18, 291, 62), YELLOW)
    polygon(
        draw,
        [(0, 112), (50, 64), (94, 102), (150, 52), (215, 104), (274, 71), (320, 110)],
        "#9FC2AF",
    )
    polygon(
        draw,
        [(0, 130), (66, 88), (122, 126), (197, 82), (248, 119), (320, 93), (320, 155), (0, 155)],
        "#6F9A83",
    )
    draw.rectangle((0, px(145), px(WIDTH), px(HEIGHT)), fill=ROAD)
    draw.rectangle((0, px(149), px(WIDTH), px(154)), fill=ROAD_LIGHT)

    dash_offset = (phase * speed * 88) % 72
    for index in range(-2, 7):
        start = index * 72 - dash_offset
        line(draw, [(start, 219), (start + 35, 219)], CREAM, 5)

    if finish_x is not None:
        cell = 8
        for row in range(6):
            for column in range(3):
                color = WHITE if (row + column) % 2 == 0 else INK
                draw.rectangle(
                    (
                        px(finish_x + column * cell),
                        px(192 + row * cell),
                        px(finish_x + (column + 1) * cell),
                        px(192 + (row + 1) * cell),
                    ),
                    fill=color,
                )
        line(draw, [(finish_x, 75), (finish_x, 194)], INK, 4)
        polygon(
            draw,
            [(finish_x, 77), (finish_x + 44, 84), (finish_x, 96)],
            YELLOW,
            INK,
            2,
        )

    if feed_zone:
        polygon(
            draw,
            [(244, 81), (320, 81), (320, 137), (258, 137)],
            CREAM,
            INK,
            3,
        )
        polygon(draw, [(242, 82), (281, 55), (320, 82)], GREEN, INK, 3)


def local(
    x: float,
    y: float,
    scale: float,
    local_x: float,
    local_y: float,
) -> tuple[float, float]:
    return x + local_x * scale, y + local_y * scale


def draw_rider(
    draw: ImageDraw.ImageDraw,
    x: float,
    y: float,
    phase: float,
    jersey: str,
    scale: float = 1,
    standing: float = 0,
    celebration: float = 0,
    shrug: float = 0,
    reach: float = 0,
    gel: float = 0,
    flat_rear: float = 0,
    foot_down: float = 0,
) -> None:
    pedal_angle = phase * math.tau
    bob = math.sin(pedal_angle * 2) * 1.4 * (1 - foot_down)
    y += bob

    rear = local(x, y, scale, -40, 20)
    front = local(x, y, scale, 40, 20)
    wheel_radius = 26 * scale
    rear_height = wheel_radius * (1 - flat_rear * 0.35)

    ellipse(
        draw,
        (
            rear[0] - wheel_radius,
            rear[1] - rear_height,
            rear[0] + wheel_radius,
            rear[1] + rear_height,
        ),
        CREAM,
        INK,
        3.5,
    )
    ellipse(
        draw,
        (
            front[0] - wheel_radius,
            front[1] - wheel_radius,
            front[0] + wheel_radius,
            front[1] + wheel_radius,
        ),
        CREAM,
        INK,
        3.5,
    )

    spoke_rotation = phase * math.tau
    for center_x, center_y in (rear, front):
        for spoke in range(0, 8, 2):
            angle = spoke_rotation + spoke * math.pi / 4
            line(
                draw,
                [
                    (center_x, center_y),
                    (
                        center_x + math.cos(angle) * wheel_radius * 0.88,
                        center_y + math.sin(angle) * wheel_radius * 0.88,
                    ),
                ],
                "#A4AEA9",
                1,
            )

    crank = local(x, y, scale, 0, 18)
    seat = local(x, y, scale, -16, -7)
    head = local(x, y, scale, 27, -7)
    handle = local(x, y, scale, 37, -16)

    line(draw, [rear, crank, seat, rear], BLUE, 5 * scale)
    line(draw, [crank, front, head, crank], BLUE, 5 * scale)
    line(draw, [seat, head], BLUE, 5 * scale)
    line(draw, [head, front], INK, 3 * scale)
    line(draw, [handle, head], INK, 3.5 * scale)
    line(
        draw,
        [local(x, y, scale, -25, -9), local(x, y, scale, -8, -9)],
        INK,
        4 * scale,
    )
    line(
        draw,
        [local(x, y, scale, 31, -17), local(x, y, scale, 44, -17)],
        INK,
        3.5 * scale,
    )

    crank_radius = 10 * scale
    foot_a = (
        crank[0] + math.cos(pedal_angle) * crank_radius,
        crank[1] + math.sin(pedal_angle) * crank_radius,
    )
    foot_b = (
        crank[0] - math.cos(pedal_angle) * crank_radius,
        crank[1] - math.sin(pedal_angle) * crank_radius,
    )
    ellipse(draw, (crank[0] - 3, crank[1] - 3, crank[0] + 3, crank[1] + 3), YELLOW, INK, 1)
    line(draw, [foot_a, foot_b], INK, 2.5 * scale)

    hip = local(x, y, scale, -12 + standing * 6, -18 - standing * 9)
    shoulder = local(x, y, scale, 1 + standing * 4, -49 - standing * 6)
    head_center = local(x, y, scale, 7 + standing * 5, -66 - standing * 6)

    if foot_down > 0:
        planted = local(x, y, scale, -28, 47)
        foot_a = (
            foot_a[0] * (1 - foot_down) + planted[0] * foot_down,
            foot_a[1] * (1 - foot_down) + planted[1] * foot_down,
        )

    def draw_leg(foot: tuple[float, float], bend: float) -> None:
        knee = (
            (hip[0] + foot[0]) / 2 + bend * scale,
            (hip[1] + foot[1]) / 2 - 2 * scale,
        )
        line(draw, [hip, knee, foot], INK, 6 * scale)

    draw_leg(foot_a, 9)
    draw_leg(foot_b, -7)

    torso_left = local(x, y, scale, -11 + standing * 5, -23 - standing * 8)
    torso_right = local(x, y, scale, 15 + standing * 5, -24 - standing * 8)
    polygon(
        draw,
        [torso_left, shoulder, local(x, y, scale, 13 + standing * 4, -47 - standing * 6), torso_right],
        jersey,
        INK,
        3 * scale,
    )
    ellipse(
        draw,
        (
            head_center[0] - 10 * scale,
            head_center[1] - 11 * scale,
            head_center[0] + 10 * scale,
            head_center[1] + 11 * scale,
        ),
        SKIN,
        INK,
        2.5 * scale,
    )
    line(
        draw,
        [
            (head_center[0] - 10 * scale, head_center[1] - 5 * scale),
            (head_center[0] + 9 * scale, head_center[1] - 8 * scale),
        ],
        YELLOW,
        5 * scale,
    )

    left_shoulder = (shoulder[0] - 5 * scale, shoulder[1] + 4 * scale)
    right_shoulder = (shoulder[0] + 7 * scale, shoulder[1] + 5 * scale)
    bar_hand_left = local(x, y, scale, 31, -16)
    bar_hand_right = local(x, y, scale, 41, -16)

    if celebration > 0:
        left_target = local(x, y, scale, -22, -91)
        right_target = local(x, y, scale, 35, -91)
        left_hand = (
            bar_hand_left[0] * (1 - celebration) + left_target[0] * celebration,
            bar_hand_left[1] * (1 - celebration) + left_target[1] * celebration,
        )
        right_hand = (
            bar_hand_right[0] * (1 - celebration) + right_target[0] * celebration,
            bar_hand_right[1] * (1 - celebration) + right_target[1] * celebration,
        )
    elif shrug > 0:
        left_target = local(x, y, scale, -36, -56)
        right_target = local(x, y, scale, 42, -55)
        left_hand = (
            bar_hand_left[0] * (1 - shrug) + left_target[0] * shrug,
            bar_hand_left[1] * (1 - shrug) + left_target[1] * shrug,
        )
        right_hand = (
            bar_hand_right[0] * (1 - shrug) + right_target[0] * shrug,
            bar_hand_right[1] * (1 - shrug) + right_target[1] * shrug,
        )
    elif reach > 0:
        reach_target = local(x, y, scale, 74, -32)
        left_hand = bar_hand_left
        right_hand = (
            bar_hand_right[0] * (1 - reach) + reach_target[0] * reach,
            bar_hand_right[1] * (1 - reach) + reach_target[1] * reach,
        )
    elif gel > 0:
        mouth = (head_center[0] + 8 * scale, head_center[1] + 3 * scale)
        left_hand = bar_hand_left
        right_hand = (
            bar_hand_right[0] * (1 - gel) + mouth[0] * gel,
            bar_hand_right[1] * (1 - gel) + mouth[1] * gel,
        )
    else:
        left_hand = bar_hand_left
        right_hand = bar_hand_right

    def draw_arm(start: tuple[float, float], hand: tuple[float, float], direction: float) -> None:
        elbow = (
            (start[0] + hand[0]) / 2 + direction * 5 * scale,
            (start[1] + hand[1]) / 2 + 5 * scale,
        )
        line(draw, [start, elbow, hand], INK, 5 * scale)

    draw_arm(left_shoulder, left_hand, -1)
    draw_arm(right_shoulder, right_hand, 1)

    if gel > 0.65:
        gel_box = (
            right_hand[0] - 5 * scale,
            right_hand[1] - 7 * scale,
            right_hand[0] + 5 * scale,
            right_hand[1] + 7 * scale,
        )
        draw.rounded_rectangle(
            tuple(px(value) for value in gel_box),
            radius=px(2),
            fill=CORAL,
            outline=INK,
            width=px(1.5),
        )


def make_frame(renderer: Callable[[ImageDraw.ImageDraw, float], None], index: int) -> Image.Image:
    canvas = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), SKY)
    renderer(ImageDraw.Draw(canvas), index / (FRAME_COUNT - 1))
    return canvas.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def train_frame(draw: ImageDraw.ImageDraw, phase: float) -> None:
    draw_background(draw, phase, speed=1.3)
    for index, x in enumerate((70, 160, 250)):
        draw_rider(
            draw,
            x,
            171,
            phase * 1.6 + index * 0.08,
            GREEN if index != 1 else MINT,
            scale=0.72,
        )
    line(draw, [(22, 44), (100, 44)], GREEN, 5)
    polygon(draw, [(100, 44), (88, 36), (88, 52)], GREEN)


def tactical_attack_frame(draw: ImageDraw.ImageDraw, phase: float) -> None:
    acceleration = segment(phase, 0.18, 0.7)
    draw_background(draw, phase, speed=0.8 + acceleration * 1.5)
    draw_rider(draw, 55, 174, phase * 1.2, MINT, scale=0.68)
    draw_rider(draw, 106, 173, phase * 1.25 + 0.3, MINT, scale=0.7)
    attacker_x = 143 + acceleration * 93
    draw_rider(
        draw,
        attacker_x,
        170,
        phase * (1.4 + acceleration),
        CORAL,
        scale=0.82,
        standing=acceleration,
    )
    if acceleration > 0.25:
        for offset in (0, 13, 26):
            line(
                draw,
                [
                    (attacker_x - 62 - offset, 102 + offset * 0.25),
                    (attacker_x - 35 - offset, 102 + offset * 0.25),
                ],
                YELLOW,
                3,
            )


def feed_zone_frame(draw: ImageDraw.ImageDraw, phase: float) -> None:
    draw_background(draw, phase, speed=1.1, feed_zone=True)
    approach = segment(phase, 0.0, 0.38)
    rider_x = 82 + approach * 122
    reach = segment(phase, 0.2, 0.39)
    draw_rider(
        draw,
        rider_x,
        172,
        phase * 1.8,
        GREEN,
        scale=0.78,
        reach=reach,
    )

    staff_hand = (263, 148)
    ellipse(draw, (270, 88, 292, 110), SKIN, INK, 2)
    polygon(draw, [(260, 109), (302, 108), (313, 159), (270, 164)], CORAL, INK, 3)
    line(draw, [(275, 123), staff_hand], INK, 6)

    if phase < 0.4:
        bag_x, bag_y = 252, 152
    else:
        bag_x, bag_y = rider_x + 58, 147
    polygon(
        draw,
        [(bag_x - 14, bag_y - 8), (bag_x + 14, bag_y - 8), (bag_x + 10, bag_y + 29), (bag_x - 11, bag_y + 29)],
        CREAM,
        INK,
        2.5,
    )
    line(draw, [(bag_x - 12, bag_y - 8), (bag_x, bag_y - 25), (bag_x + 12, bag_y - 8)], GREEN, 3)

    spill = segment(phase, 0.52, 0.9)
    if spill > 0:
        line(draw, [(bag_x - 10, bag_y + 29), (bag_x + 10, bag_y + 29)], CORAL, 4)
        foods = [
            (-8, YELLOW, 0.0),
            (4, CORAL, 0.12),
            (14, MINT, 0.23),
            (-18, YELLOW, 0.34),
        ]
        for horizontal, color, delay in foods:
            item_phase = max(0, (spill - delay) / max(0.01, 1 - delay))
            item_x = bag_x + horizontal + item_phase * horizontal * 0.8
            item_y = bag_y + 22 + item_phase * 62 + item_phase * item_phase * 22
            if color == YELLOW:
                line(draw, [(item_x - 5, item_y - 2), (item_x, item_y + 4), (item_x + 5, item_y - 1)], YELLOW, 4)
            else:
                draw.rounded_rectangle(
                    (px(item_x - 5), px(item_y - 8), px(item_x + 5), px(item_y + 8)),
                    radius=px(2),
                    fill=color,
                    outline=INK,
                    width=px(1),
                )


def puncture_frame(draw: ImageDraw.ImageDraw, phase: float) -> None:
    stop = segment(phase, 0.26, 0.62)
    draw_background(draw, phase, speed=1 - stop * 0.9)
    rider_x = 110 + segment(phase, 0.0, 0.45) * 50
    flat = segment(phase, 0.28, 0.52)
    shrug = segment(phase, 0.58, 0.78)
    draw_rider(
        draw,
        rider_x,
        171,
        phase * 1.4 * (1 - stop * 0.65),
        CORAL,
        scale=0.88,
        flat_rear=flat,
        foot_down=segment(phase, 0.48, 0.68),
        shrug=shrug,
    )
    if flat > 0.2:
        for y in (173, 183, 193):
            line(draw, [(rider_x - 69, y), (rider_x - 82, y - 4)], CORAL, 3)
    if shrug > 0.7:
        ellipse(draw, (262, 90, 280, 108), SKIN, INK, 2)
        polygon(draw, [(253, 107), (289, 108), (301, 156), (260, 158)], GREEN, INK, 3)
        line(draw, [(265, 124), (245, 132)], INK, 5)
        line(draw, [(281, 123), (303, 116)], INK, 5)


def early_celebration_frame(draw: ImageDraw.ImageDraw, phase: float) -> None:
    draw_background(draw, phase, speed=0.9, finish_x=207)
    celebration = segment(phase, 0.15, 0.38)
    draw_rider(
        draw,
        151,
        170,
        phase * 1.2,
        MINT,
        scale=0.84,
        celebration=celebration,
    )
    rival_progress = segment(phase, 0.3, 0.78)
    rival_x = 35 + rival_progress * 220
    draw_rider(
        draw,
        rival_x,
        175,
        phase * 2.0,
        YELLOW,
        scale=0.7,
        standing=segment(phase, 0.38, 0.62),
    )
    if rival_progress > 0.65:
        line(draw, [(rival_x - 64, 105), (rival_x - 40, 105)], CORAL, 3)
        line(draw, [(rival_x - 70, 116), (rival_x - 43, 116)], CORAL, 3)


def gel_spray_frame(draw: ImageDraw.ImageDraw, phase: float) -> None:
    draw_background(draw, phase, speed=1.05)
    reaction = segment(phase, 0.58, 0.78)
    draw_rider(
        draw,
        91,
        176,
        phase * 1.55 + 0.25,
        YELLOW,
        scale=0.68,
        shrug=reaction * 0.75,
    )
    gel = segment(phase, 0.18, 0.5)
    draw_rider(
        draw,
        179,
        170,
        phase * 1.5,
        GREEN,
        scale=0.82,
        gel=gel,
    )
    spray = segment(phase, 0.5, 0.72)
    if spray > 0:
        for index in range(7):
            progress = max(0, min(1, spray * 1.4 - index * 0.08))
            start_x = 181
            start_y = 112
            end_x = 105 - index * 2
            end_y = 108 + index * 3
            x = start_x + (end_x - start_x) * progress
            y = start_y + (end_y - start_y) * progress - math.sin(progress * math.pi) * (12 + index)
            ellipse(draw, (x - 3, y - 2, x + 3, y + 2), CREAM, CORAL, 1)


ANIMATIONS: list[tuple[str, Callable[[ImageDraw.ImageDraw, float], None]]] = [
    ("team-train.gif", train_frame),
    ("tactical-attack.gif", tactical_attack_frame),
    ("feed-zone-chaos.gif", feed_zone_frame),
    ("flat-tire-shrug.gif", puncture_frame),
    ("early-celebration.gif", early_celebration_frame),
    ("gel-spray.gif", gel_spray_frame),
]


def main() -> None:
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    durations = [85] * (FRAME_COUNT - 1) + [650]

    for filename, renderer in ANIMATIONS:
        frames = [make_frame(renderer, index) for index in range(FRAME_COUNT)]
        output_path = OUTPUT_DIRECTORY / filename
        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            optimize=True,
            disposal=2,
        )
        print(f"{filename}: {len(frames)} frames, {WIDTH}x{HEIGHT}")


if __name__ == "__main__":
    main()
