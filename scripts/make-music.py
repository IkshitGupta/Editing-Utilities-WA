"""Builds the built-in background tunes in assets/music.

Usage: python scripts/make-music.py --ffmpeg PATH --fluidsynth PATH --soundfont PATH [--work DIR]

Downloads the FreePD recordings listed below from the Internet Archive and checks them against
the SHA-256 hashes recorded when they were chosen (FreePD itself went offline in 2026). Writes
the tune arranged for the app as MIDI and renders it with FluidSynth and the GeneralUser GS
sound bank. Every tune is then trimmed, brought to the same loudness and saved in assets/music
as AAC. The lengths for src/features/video-editor/tunes.ts are printed at the end.
Requires a Windows build of FFmpeg (ffmpeg and ffprobe, with the aac_mf encoder), FluidSynth
and GeneralUser GS; no Python packages.
"""

import argparse
import gzip
import hashlib
import json
import random
import re
import struct
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "music"

# Every tune plays at about the same loudness, with room left because AAC encoding raises peaks a
# little.
TARGET_LUFS = -16.0
TARGET_PEAK_DBTP = -1.5
LIMITER_CEILING_DBFS = -2.0
MAX_LIMITING_DB = 5.0
SAMPLE_RATE = 44100
BITRATE = "128k"
SILENCE_DB = -60
# Windows' Media Foundation AAC encoder keeps peaks close to the original, where FFmpeg's own
# encoder occasionally overshoots by several decibels on dense music. It adds no lead-in and no
# gapless information, but leaves the first 10 ms of a file silent, so every AAC tune starts with
# 20 ms of silence, and the arranged tune lasts a whole number of AAC frames so it repeats without
# a gap.
AAC_ENCODER = "aac_mf"
AAC_FRAME = 1024
LEAD_IN_MS = 20

ARCHIVE = "https://web.archive.org/web/{stamp}id_/https://freepd.com/music/{name}.mp3"

# (file id, title, archive capture, SHA-256 of the MP3). Captured from freepd.com, CC0 1.0.
FREEPD = [
    ("cheerful-happy-whistling-ukulele", "Happy Whistling Ukulele", "20251117234159",
     "ed4059c8fba8673d657e85175ff54eaa32cef9e43f688f164bef585e6e65cf15"),
    ("cheerful-ukulele-song", "Ukulele Song", "20251011155222",
     "ad54684b7dffd48dcc09c12a0093d375ea1edcaa418bad714d4f54b16a95c81d"),
    ("cheerful-pickled-pink", "Pickled Pink", "20251011155222",
     "3eacbde6e5322792cec71bc4942c4f7bff86f6b33e1836a1520db198c475b904"),
    ("playful-and-just-like-that", "And Just Like That", "20251118002951",
     "75e6438a8d6d1dcb54dd42cc02f4944b484e73dac48502eb78514c438cada914"),
    ("playful-my-giant-bunny-friend", "My Giant Bunny Friend", "20250812115026",
     "696d1e335debd934813e8f4e8703d98ec456d1b87ded7ed630787e60c06c2a5e"),
    ("playful-hopeful", "Hopeful", "20250812115037",
     "cbd585a3c26795a994495864d0e297222f9c679457a3baea7d322017973d99d9"),
    ("gentle-pond", "Pond", "20250911140703",
     "68bf0d67ca7c3304bfecad346547dda5a5d95c7d2f5631d6e4e8bd3d3b87fb8c"),
    ("gentle-connecting-rainbows", "Connecting Rainbows", "20250913230541",
     "85f77462ba2ff846ed5bfa911a267f8a8ea0b2c579b58278a2bcef1e26efb81a"),
    ("gentle-painting-room", "Painting Room", "20251122233235",
     "ddfb9a5aa5420f1894902b290b7afc421ae644f6b5f4d4d9e24e5d464d95b1d1"),
    ("heartfelt-motions", "Motions", "20251011155222",
     "af6380fde14f41dc4762a0a69c558bfd03a8a88c10cb5c8f578a6d0bcb4750be"),
    ("heartfelt-inspiration", "Inspiration", "20251011155222",
     "a254227da398809c79a0c753073a3a92c7341672abc92bb0166b6326e126f0b4"),
    ("energetic-city-sunshine", "City Sunshine", "20251011155222",
     "e05c1bd683174cff77d492b7ac77262ff4617f99f69d82564b66831cf48352d6"),
]

PPQ = 480


def download(stamp, name, sha256, target):
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == sha256:
        return
    url = ARCHIVE.format(stamp=stamp, name=urllib.parse.quote(name))
    for attempt in range(5):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "make-music"})
            with urllib.request.urlopen(request, timeout=180) as response:
                data = response.read()
            break
        except OSError:
            if attempt == 4:
                raise
            time.sleep(10 * (attempt + 1))
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    digest = hashlib.sha256(data).hexdigest()
    if digest != sha256:
        raise SystemExit(f"{name}: the downloaded file does not match the recorded hash ({digest}).")
    target.write_bytes(data)


# --- MIDI -------------------------------------------------------------------------------------


def variable_length(value):
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(out))


class Part:
    """One instrument on one MIDI channel. Times are in beats."""

    def __init__(self, channel, program, volume=100, pan=64, reverb=40, chorus=0):
        self.channel = channel
        self.events = []
        # The drum channel keeps the synth's own percussion bank.
        controls = ((7, volume), (10, pan), (91, reverb), (93, chorus))
        if channel != DRUMS:
            controls = ((0, 0), (32, 0)) + controls
        for number, value in controls:
            self.events.append((0, 1, bytes([0xB0 | channel, number, value])))
        self.events.append((0, 1, bytes([0xC0 | channel, program])))

    def note(self, start, length, pitch, velocity):
        on = round(start * PPQ)
        off = max(on + 1, round((start + length) * PPQ))
        self.events.append((on, 2, bytes([0x90 | self.channel, pitch, velocity])))
        # Note-offs sort first at a shared time, so a repeated note is struck again cleanly.
        self.events.append((off, 0, bytes([0x80 | self.channel, pitch, 0])))

    def chord(self, start, length, pitches, velocity):
        for pitch in pitches:
            self.note(start, length, pitch, velocity)


def track_chunk(events, end_tick):
    data = bytearray()
    last = 0
    for tick, _, message in sorted(events, key=lambda event: (event[0], event[1])):
        data += variable_length(tick - last) + message
        last = tick
    data += variable_length(max(0, end_tick - last)) + b"\xff\x2f\x00"
    return b"MTrk" + struct.pack(">I", len(data)) + bytes(data)


def write_midi(path, bpm, beats_per_bar, length_beats, parts):
    end_tick = round(length_beats * PPQ)
    tempo = round(60_000_000 / bpm).to_bytes(3, "big")
    meta = [
        (0, 1, b"\xff\x51\x03" + tempo),
        (0, 1, bytes([0xFF, 0x58, 0x04, beats_per_bar, 2, 24, 8])),
    ]
    chunks = [track_chunk(meta, end_tick)] + [track_chunk(part.events, end_tick) for part in parts]
    header = b"MThd" + struct.pack(">IHHH", 6, 1, len(chunks), PPQ)
    path.write_bytes(header + b"".join(chunks))


# General MIDI programs and percussion keys.
PIANO, CELESTA, GLOCKENSPIEL = 0, 8, 9
ACOUSTIC_BASS, FLUTE = 32, 73
KICK, CLAP, TAMBOURINE, TRIANGLE = 36, 39, 54, 81
DRUMS = 9


def happy_birthday():
    """"Happy Birthday" (Mildred and Patty Hill, 1893; public domain) as a waltz for the app.

    A two-bar intro, the tune on celesta, the tune again on glockenspiel and flute with light
    percussion, and a short closing bar. The last beat is left free so the ending dies away
    before the tune starts again. 19 bars of 3/4 at 100 bpm: 34.2 seconds.
    """
    rng = random.Random(1893)

    def humanise(velocity):
        return max(1, min(127, velocity + rng.randint(-5, 5)))

    piano = Part(0, PIANO, volume=88, pan=60, reverb=45)
    celesta = Part(1, CELESTA, volume=112, pan=72, reverb=60)
    glockenspiel = Part(2, GLOCKENSPIEL, volume=92, pan=56, reverb=60)
    flute = Part(3, FLUTE, volume=84, pan=74, reverb=55)
    bass = Part(4, ACOUSTIC_BASS, volume=96, pan=64, reverb=20)
    drums = Part(DRUMS, 0, volume=76, pan=64, reverb=35)

    chords = {
        "C": (48, (60, 64, 67)),
        "G7": (43, (59, 62, 65)),
        "C7": (48, (58, 64, 67)),
        "F": (41, (60, 65, 69)),
    }
    # The tune, as (beat from the start of the verse, length, pitch); the pickup comes first.
    tune = [
        (-1, 0.75, 67), (-0.25, 0.25, 67),
        (0, 1, 69), (1, 1, 67), (2, 1, 72),
        (3, 2, 71), (5, 0.75, 67), (5.75, 0.25, 67),
        (6, 1, 69), (7, 1, 67), (8, 1, 74),
        (9, 2, 72), (11, 0.75, 67), (11.75, 0.25, 67),
        (12, 1, 79), (13, 1, 76), (14, 1, 72),
        (15, 1, 71), (16, 1, 69), (17, 0.75, 77), (17.75, 0.25, 77),
        (18, 1, 76), (19, 1, 72), (20, 1, 74),
    ]
    harmony = ["C", "G7", "G7", "C", "C7", "F", "C", "C"]

    def waltz(bar, name, third_beat=None):
        root, triad = chords[name]
        start = bar * 3
        piano.note(start, 1, root, humanise(70))
        piano.chord(start + 1, 0.8, triad, humanise(56))
        later_root, later_triad = chords[third_beat or name]
        piano.chord(start + 2, 0.8, later_triad, humanise(52))
        return root, later_root

    def verse(first_bar, melody_parts, last_length, with_rhythm):
        start = first_bar * 3
        for beat, length, pitch in tune:
            for part, shift, velocity in melody_parts:
                accent = 8 if beat == int(beat) and int(beat) % 3 == 0 else 0
                part.note(start + beat, length * 0.95, pitch + shift, humanise(velocity + accent))
        for part, shift, velocity in melody_parts:
            part.note(start + 21, last_length, 72 + shift, humanise(velocity + 6))
        for index, name in enumerate(harmony):
            bar = first_bar + index
            root, _ = waltz(bar, name, "G7" if index == 6 else None)
            if with_rhythm:
                bass.note(bar * 3, 1.6, root - 12, humanise(88))
                drums.note(bar * 3, 0.5, KICK, humanise(62))
                drums.note(bar * 3 + 1, 0.5, CLAP, humanise(46))
                drums.note(bar * 3 + 2, 0.5, CLAP, humanise(42))
                for eighth in range(6):
                    drums.note(bar * 3 + eighth / 2, 0.25, TAMBOURINE, humanise(34 if eighth % 2 else 44))
                if index % 2 == 0:
                    drums.note(bar * 3, 1, TRIANGLE, humanise(40))

    # Intro: the accompaniment with a few bell notes, ending in the first pickup.
    waltz(0, "C")
    waltz(1, "G7")
    for beat, pitch in ((0, 84), (1, 88), (2, 91), (3, 86), (4, 83)):
        celesta.note(beat, 0.9, pitch, humanise(70))

    verse(2, [(celesta, 12, 92)], 2, with_rhythm=False)
    verse(10, [(glockenspiel, 12, 80), (flute, 0, 80)], 3, with_rhythm=True)

    # Closing bar: a rising bell figure over the home chord, then a beat of quiet.
    piano.chord(54, 2, (48, 55, 60, 64, 67), humanise(64))
    bass.note(54, 2, 36, humanise(80))
    for step, pitch in enumerate((84, 88, 91, 96)):
        celesta.note(54 + step * 0.5, 0.9 if step < 3 else 1.4, pitch, humanise(74 + step * 4))
    drums.note(54, 1.5, TRIANGLE, humanise(52))
    return 100, 3, 57, [piano, celesta, glockenspiel, flute, bass, drums]


# --- Audio ------------------------------------------------------------------------------------


def run(command):
    return subprocess.run(command, check=True, capture_output=True, text=True, errors="replace")


def loudness(ffmpeg, source, filters):
    chain = f"{filters},loudnorm=I={TARGET_LUFS}:TP={TARGET_PEAK_DBTP}:print_format=json"
    stderr = run([ffmpeg, "-hide_banner", "-nostats", "-i", str(source), "-af", chain, "-f", "null", "-"]).stderr
    measured = json.loads(re.findall(r"\{[^{}]*\}", stderr)[-1])
    return float(measured["input_i"]), float(measured["input_tp"])


def encode(ffmpeg, source, filters, target):
    integrated, peak = loudness(ffmpeg, source, filters)
    gain = TARGET_LUFS - integrated
    level = f"volume={gain:.2f}dB"
    excess = peak + gain - TARGET_PEAK_DBTP
    if excess > 0:
        # Raising a quiet, dynamic tune (a harp, say) would clip its loudest notes, so a lookahead
        # limiter lowers just those peaks. Beyond a few decibels the tune stays a little quieter.
        gain -= max(0.0, excess - MAX_LIMITING_DB)
        ceiling = 10 ** (LIMITER_CEILING_DBFS / 20)
        level = (f"volume={gain:.2f}dB,alimiter=limit={ceiling:.4f}:attack=5:release=100"
                 f":asc=1:level=0")
    run([
        ffmpeg, "-hide_banner", "-y", "-i", str(source), "-vn", "-map_metadata", "-1",
        "-af", f"{filters},{level}", "-ar", str(SAMPLE_RATE), "-ac", "2",
        "-c:a", AAC_ENCODER, "-b:a", BITRATE, "-movflags", "+faststart", str(target),
    ])
    return integrated, gain


def lead_in():
    return f"adelay={LEAD_IN_MS}:all=1"


def trim_silence():
    edge = f"silenceremove=start_periods=1:start_threshold={SILENCE_DB}dB:detection=peak"
    return f"aformat=sample_rates={SAMPLE_RATE},{edge},areverse,{edge},areverse,{lead_in()}"


def whole_bars(length_s):
    """Keeps the arranged length, rounded to whole AAC frames. The lead-in comes out of the quiet
    last beat, and a short fade removes whatever is left of the last note."""
    samples = round(length_s * SAMPLE_RATE / AAC_FRAME) * AAC_FRAME
    fade_start_s = samples / SAMPLE_RATE - 0.2
    return (
        f"aformat=sample_rates={SAMPLE_RATE},{lead_in()},apad=whole_len={samples},"
        f"atrim=end_sample={samples},afade=t=out:st={fade_start_s:.4f}:d=0.2"
    )


def render(fluidsynth, soundfont, midi, wav):
    run([
        fluidsynth, "-ni", "-q", "-r", str(SAMPLE_RATE), "-g", "0.6", "-O", "float",
        "-o", "synth.reverb.active=1", "-o", "synth.chorus.active=1",
        "-F", str(wav), "-T", "wav", str(soundfont), str(midi),
    ])


def duration_ms(ffmpeg, path):
    ffprobe = str(Path(ffmpeg).with_name(Path(ffmpeg).name.replace("ffmpeg", "ffprobe")))
    output = run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return round(float(output.stdout.strip()) * 1000)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--fluidsynth", required=True)
    parser.add_argument("--soundfont", required=True)
    parser.add_argument("--work", type=Path, default=Path(tempfile.gettempdir()) / "make-music")
    args = parser.parse_args()
    if AAC_ENCODER not in run([args.ffmpeg, "-hide_banner", "-encoders"]).stdout:
        raise SystemExit(f"This FFmpeg has no {AAC_ENCODER} encoder; use a Windows build of FFmpeg.")
    args.work.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    jobs = []
    for file_id, title, stamp, sha256 in FREEPD:
        mp3 = args.work / f"{file_id}.mp3"
        download(stamp, title, sha256, mp3)
        jobs.append((f"{file_id}.m4a", mp3, trim_silence()))

    composed = [("birthday-happy-birthday", happy_birthday)]
    for file_id, arrange in composed:
        bpm, beats_per_bar, length_beats, parts = arrange()
        midi = args.work / f"{file_id}.mid"
        wav = args.work / f"{file_id}.wav"
        write_midi(midi, bpm, beats_per_bar, length_beats, parts)
        render(args.fluidsynth, args.soundfont, midi, wav)
        jobs.append((f"{file_id}.m4a", wav, whole_bars(length_beats * 60 / bpm)))

    for name, source, filters in jobs:
        target = OUT / name
        integrated, gain = encode(args.ffmpeg, source, filters, target)
        final, peak = loudness(args.ffmpeg, target, "anull")
        print(f"{name}: {integrated:.1f} LUFS, gain {gain:+.1f} dB, now {final:.1f} LUFS "
              f"and {peak:.1f} dBTP, {duration_ms(args.ffmpeg, target)} ms, "
              f"{target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
