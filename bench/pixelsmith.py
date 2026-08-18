"""Pixel Smith adapter.

Drives the real detection/reconstruction code out of the shipped index.html
through a persistent node bridge, so the benchmark measures what ships.

Two registrations:
  pixelsmith        - shipped behaviour, including the confidence gates that
                      refuse to snap when the grid does not look real.
  pixelsmith_nogate - the same detector with the gates removed, to separate
                      "the detector was wrong" from "the gate was cautious".
"""
from __future__ import annotations

import os
import struct
import subprocess

import numpy as np

from .base import Method, Reconstruction, register

MAGIC = 0x50534D31
# copied into pixelbench/methods/ at install time, so the bridge is located by
# env var (see bench/README.md) or as a sibling of this file
BRIDGE = os.environ.get("PIXELSMITH_BRIDGE") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "psbridge.mjs")


class _Bridge:
    def __init__(self, gates: bool):
        env = dict(os.environ)
        env["PS_GATES"] = "1" if gates else "0"
        self.p = subprocess.Popen(
            ["node", BRIDGE], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, env=env, bufsize=0,
        )

    def _read(self, n: int) -> bytes:
        out = bytearray()
        while len(out) < n:
            chunk = self.p.stdout.read(n - len(out))
            if not chunk:
                raise RuntimeError("pixelsmith bridge died")
            out += chunk
        return bytes(out)

    def run(self, rgba: np.ndarray):
        h, w = rgba.shape[:2]
        self.p.stdin.write(struct.pack("<III", MAGIC, w, h))
        self.p.stdin.write(np.ascontiguousarray(rgba, np.uint8).tobytes())
        cols, rows = struct.unpack("<II", self._read(8))
        data = self._read(cols * rows * 4)
        return np.frombuffer(data, np.uint8).reshape(rows, cols, 4).copy(), cols, rows


class _Base(Method):
    gates = True
    _b = None

    def available(self) -> bool:
        return os.path.exists(BRIDGE)

    def reconstruct(self, image: np.ndarray) -> Reconstruction:
        if self._b is None:
            type(self)._b = _Bridge(self.gates)
        rgba = image if image.shape[2] == 4 else np.dstack(
            [image, np.full(image.shape[:2], 255, np.uint8)])
        native, cols, rows = type(self)._b.run(rgba)
        return Reconstruction(native=native, cols=cols, rows=rows)


@register
class PixelSmith(_Base):
    name = "pixelsmith"
    gates = True


@register
class PixelSmithNoGate(_Base):
    name = "pixelsmith_nogate"
    gates = False
