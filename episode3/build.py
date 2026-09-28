#!/usr/bin/env python3
"""Mongle Cloud Crew episode 3 - final video build (ffmpeg).

Inputs (same folder): 01.mp4-08.mp4, voice_01.mp3-voice_08.mp3, bgm.mp3 (optional)
Outputs: episode3_complete.mp4 (16:9), episode3_short.mp4 (9:16, cuts 5-8)
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

XFADE = 0.3        # crossfade between cuts (seconds)
VOICE_DELAY = 0.3  # voice starts this long after its cut starts
BGM_VOLUME = 0.25
BGM_FADE = 2.0
VOICE_LEVEL = -18.0  # every voice line is brought to this mean level (dB) so no line is buried
FONT = "DejaVu Sans"

LINES = {
    1: "Beep beep! What a nice day!",
    2: "Oh no! I'm stuck!",
    3: "Don't worry, Beepo! We're coming!",
    4: "Hmm… it's too heavy!",
    5: "Let's push together! One, two, three!",
    6: "I'm free! Thank you, friends!",
    7: "Hehe! Splash splash!",
    8: "Even helpers need help sometimes! See you next time!",
}


def duration(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    if path.endswith(".mp4"):
        # video length from the decoded frame count (24fps)
        return int(re.findall(r"frame=\s*(\d+)", err)[-1]) / 24
    h, m, s = re.findall(r"time=(\d+):(\d+):([\d.]+)", err)[-1]
    return int(h) * 3600 + int(m) * 60 + float(s)


def mean_volume(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"mean_volume: ([-\d.]+) dB", err)[-1])


def ass_time(t):
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def write_ass(path, events, w, h, size, margin_v):
    with open(path, "w", encoding="utf-8") as f:
        f.write("[Script Info]\nScriptType: v4.00+\n"
                f"PlayResX: {w}\nPlayResY: {h}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
                "[V4+ Styles]\n"
                "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
                "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
                "Alignment, MarginL, MarginR, MarginV, Encoding\n"
                f"Style: Default,{FONT},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,"
                f"-1,0,0,0,100,100,0,0,1,{max(3, size // 12)},1,2,60,60,{margin_v},1\n\n"
                "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
        for start, end, text in events:
            f.write(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{text}\n")


def build(cuts, out, w, h, crop, ass_path, sub_size, sub_margin):
    clip_d = [duration(f"{c:02d}.mp4") for c in cuts]
    voice_d = [duration(f"voice_{c:02d}.mp3") for c in cuts]

    # cut start times on the final timeline (each crossfade overlaps 0.3s)
    starts, t = [], 0.0
    for d in clip_d:
        starts.append(t)
        t += d - XFADE
    total = t + XFADE

    events, timing = [], []
    for c, s, vd in zip(cuts, starts, voice_d):
        v0 = s + VOICE_DELAY
        events.append((v0, v0 + vd, LINES[c]))
        timing.append((c, s, v0, v0 + vd))
    write_ass(ass_path, events, w, h, sub_size, sub_margin)

    args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for c in cuts:
        args += ["-i", f"{c:02d}.mp4"]
    for c in cuts:
        args += ["-i", f"voice_{c:02d}.mp3"]
    has_bgm = os.path.exists("bgm.mp3")
    if has_bgm:
        args += ["-stream_loop", "-1", "-i", "bgm.mp3"]

    n = len(cuts)
    fc = []
    for i in range(n):
        chain = f"[{i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=24"
        if crop:
            chain += ",crop=ih*9/16:ih:(iw-ih*9/16)/2:0"
        chain += f",scale={w}:{h}:flags=lanczos,setsar=1,format=yuv420p[v{i}]"
        fc.append(chain)
    prev, acc = "v0", 0.0
    for i in range(1, n):
        acc += clip_d[i - 1] - XFADE
        fc.append(f"[{prev}][v{i}]xfade=transition=fade:duration={XFADE}:offset={acc:.4f}[x{i}]")
        prev = f"x{i}"
    ass_arg = ass_path.replace(":", "\\:")
    fc.append(f"[{prev}]subtitles='{ass_arg}'[vout]")

    mix = []
    for i, (c, s, v0, v1) in enumerate(timing):
        ms = int(round(v0 * 1000))
        gain = VOICE_LEVEL - mean_volume(f"voice_{c:02d}.mp3")
        fc.append(f"[{n + i}:a]aresample=44100,aformat=channel_layouts=stereo,volume={gain:.1f}dB,"
                  f"adelay={ms}|{ms}[a{i}]")
        mix.append(f"[a{i}]")
    if has_bgm:
        fc.append(f"[{2 * n}:a]aresample=44100,aformat=channel_layouts=stereo,atrim=0:{total:.3f},"
                  f"asetpts=PTS-STARTPTS,volume={BGM_VOLUME},"
                  f"afade=t=out:st={total - BGM_FADE:.3f}:d={BGM_FADE}[bgm]")
        mix.append("[bgm]")
    fc.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=longest,"
              f"alimiter=limit=0.95,apad,atrim=0:{total:.3f}[aout]")

    args += ["-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
             "-t", f"{total:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]
    subprocess.run(args, check=True)
    return timing, total, has_bgm


if __name__ == "__main__":
    targets = sys.argv[1:] or ["complete", "short"]
    if "complete" in targets:
        timing, total, bgm = build(list(range(1, 9)), "episode3_complete.mp4", 1280, 720, False,
                                   "subs_complete.ass", 54, 40)
        print(f"complete: {total:.2f}s bgm={bgm}")
        for c, s, v0, v1 in timing:
            print(f"  cut {c}: starts {s:.2f}s, voice {v0:.2f}-{v1:.2f}s")
    if "short" in targets:
        timing, total, bgm = build([5, 6, 7, 8], "episode3_short.mp4", 1080, 1920, True,
                                   "subs_short.ass", 72, 260)
        print(f"short: {total:.2f}s bgm={bgm}")
        for c, s, v0, v1 in timing:
            print(f"  cut {c}: starts {s:.2f}s, voice {v0:.2f}-{v1:.2f}s")
