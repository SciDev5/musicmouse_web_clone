"use client"

import { useEffect, useMemo, useState } from "react";
import { CanvasEngine, FrameData, FrameHandlerObject } from "./CanvasEngine";
import { NoteQueue, SimpleVoice, Synth } from "./synth";

const D = 130
const R = 84

class MusicMouseHandler implements FrameHandlerObject {
    private readonly note_queue = new NoteQueue()

    private synth: Synth | null = null
    activate = () => {
        if (this.synth != null) return
        this.synth = new Synth()
        this.synth.add_voices((a, d) => new SimpleVoice(a, d), 20)
        this.note_queue.bind(this.synth)
        this.step_t = this.next_step_t(this.synth)
        console.log("activated audio")
    }

    private mouse_raw = { x: 0, y: 0 }
    private mouse_key = { x: 0, y: 0 }
    private hover = false
    private shift = false
    private get held(): boolean { return this.hover && !this.shift }

    on_mouse_exit = (e: MouseEvent) => {
        this.hover = false
    }
    on_mouse_move = (e: MouseEvent) => {
        this.shift = e.shiftKey
        this.hover = false
        const s = Math.min(document.body.clientWidth, document.body.clientHeight * 1.3) / D
        const x = (e.pageX - document.body.clientWidth / 2) / s
        const y = (e.pageY - document.body.clientHeight / 2) / s
        if (Math.max(Math.abs(x), Math.abs(y)) > R / 2) return
        this.mouse_raw = { x, y }
        this.hover = true

    }

    playing = false
    on_click = (e: MouseEvent) => {
        this.playing = !this.playing
        // this.step_i = 0
    }

    private readonly chord_pattern = [true, true, true, false, true, true, false, false]
    private strum = false

    private readonly keys_held = new Set<string>()
    private number_held: number = 0
    on_key_down = (e: KeyboardEvent) => {
        if (e.key === "Shift") {
            this.shift = true
        }
        this.keys_held.add(e.key.toLowerCase())
        if ("1234!@#$".includes(e.key)) {
            const n = { "!": 0, "1": 0, "@": 1, "2": 1, "#": 2, "3": 2, "$": 3, "4": 3 }[e.key]!
            this.number_held = n
            if (this.keys_held.has("`") || this.keys_held.has("~")) {
                this.chordnote_enabled[n] = !this.chordnote_enabled[n]
            }
            if (this.keys_held.has("a")) {
                this.chordnote_enabled[n] = !this.chordnote_enabled[n]
            }
        }
        const n = this.number_held
        if ("`~".includes(e.key) && !this.keys_held.isDisjointFrom(new Set("1234!@#$".split("")))) {
            this.chordnote_enabled[n] = !this.chordnote_enabled[n]
        }
        if ("wertyuio".includes(e.key.toLowerCase())) {
            const j = "wertyuio".indexOf(e.key.toLowerCase())
            this.chord_pattern[j] = !this.chord_pattern[j]
        }
        switch (e.key.toLowerCase()) {
            case "+":
            case "=": {
                this.chordnote_offsets[n]! += 1

            } break
            case "-":
            case "_": {
                this.chordnote_offsets[n]! -= 1

            } break
            case "a": {
                this.chordnote_horizontal[n] = true
            } break
            case "s": {
                this.chordnote_horizontal[n] = false
            } break

            case "z": {
                this.scale_rotation = (this.scale_rotation + 11) % 12
            } break
            case "x": {
                this.scale_rotation = (this.scale_rotation + 1) % 12
            } break
            case "c": {
                this.scale_n = 0
            } break
            case "v": {
                this.scale_n = 1
            } break
            case "b": {
                this.scale_n = 2
            } break

            case "q": {
                this.strum = !this.strum
            } break
        }
    }
    on_key_up = (e: KeyboardEvent) => {
        if (e.key === "Shift") {
            this.shift = false
        }
        this.keys_held.delete(e.key.toLowerCase())
    }

    init() {
        addEventListener("mousedown", this.activate, { once: true })
        addEventListener("click", this.on_click)
        addEventListener("mousemove", this.on_mouse_move)
        addEventListener("mouseleave", this.on_mouse_exit)
        addEventListener("mouseout", this.on_mouse_exit)
        addEventListener("keydown", this.on_key_down)
        addEventListener("keyup", this.on_key_up)
    }
    destroy() {
        console.log("destroyed");

        removeEventListener("mousedown", this.activate)
        removeEventListener("click", this.on_click)
        removeEventListener("mousemove", this.on_mouse_move)
        removeEventListener("mouseleave", this.on_mouse_exit)
        removeEventListener("mouseout", this.on_mouse_exit)
        removeEventListener("keydown", this.on_key_down)
        removeEventListener("keyup", this.on_key_up)
        this.note_queue.unbind()

    }

    update_mouse() {
        if (this.held) {
            this.mouse_key = {
                x: Math.floor(this.mouse_raw.x + R / 2),
                y: R - Math.floor(this.mouse_raw.y + R / 2) - 1,
            }
        }
    }

    private step_interval = 1 / 16
    private step_t = -Infinity
    private step_i = 0

    readonly chordnote_offsets = [0, 2, 5, 7]
    readonly chordnote_horizontal = [false, true, false, true]
    readonly chordnote_enabled = [true, true, true, true]

    private scale_n = 2
    private scale_rotation = 0
    readonly scale_ens = [
        scale_from_str("_ _ __ _ _ _"),
        scale_from_str("_ __ _ _ _ _"),
        scale_from_str("_ __ _ _ __ "),
    ]
    readonly scale_names = ["MAJOR", "MINOR", "DORIAN"]
    readonly note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    chordnote_positions(scale: Arr12<boolean>): number[] {
        const mapping = gen_scale_mappings(scale)
        return (
            this.chordnote_offsets
                .map((off, i) => (
                    this.chordnote_horizontal[i]!
                        ? this.mouse_key.y
                        : this.mouse_key.x
                ) + off)
                .map(v => apply_scale_remap(v, mapping))
                .map(v => v < 0 ? (v % 12 + 12) % 12 : v >= R ? v - Math.floor(1 + (v - R) / 12) * 12 : v)
        )
    }
    update_music(dt: number, scale: Arr12<boolean>) {
        const s = this.synth
        const q = this.note_queue

        const chord = this.chordnote_positions(scale)

        // console.log(s);

        if (s == null) return

        if (s.actx.currentTime - this.step_t > 3 * this.step_interval) {
            this.step_t = this.next_step_t(s)
        }
        if (s.actx.currentTime + dt * 2 > this.step_t && this.playing) {
            this.step_t += this.step_interval
            this.step_music(this.step_t, this.step_i, s, q, chord)
            // this.step_t = this.next_step_t(s)
            this.step_i += 1
        }
    }
    step_music(t: number, i: number, s: Synth, q: NoteQueue, chord: number[]) {
        if (this.chord_pattern[Math.floor(i / 4) % 8]) {
            if (this.strum) {
                if (this.chordnote_enabled[i % 4]) {
                    q.notes.push({
                        on: t, off: t + 0.25, freq: 524 * 2 ** (
                            chord[i % 4]! / 12 - 5), vel: 1
                    })
                }
            } else if (i % 4 == 0) {
                for (const note of chord.filter((_, i) => this.chordnote_enabled[i])) {
                    q.notes.push({ on: t, off: t + 0.25, freq: 524 * 2 ** (note / 12 - 5), vel: 1 })
                }
            }
        }
    }

    next_step_t(synth: Synth): number {
        return (
            Math.floor(synth.actx.currentTime / this.step_interval) + 2
        ) * this.step_interval
    }


    draw({ ctx, t, dt, cnv: { width, height } }: FrameData) {
        const s = Math.min(width, height * 1.3) / D
        ctx.translate(width / 2, height / 2)
        ctx.scale(s, s)

        const PRIMARY_COLOR = this.held ? "#ffffff" : "#777777"
        const SECONDARY_COLOR = this.held ? "#222222" : "#111111"
        // const NOTE_COLOR = ["#00ff77", "#00ffff", "#0077ff", "#ff00ff"]
        const NOTE_COLOR = ["#da0d4a", "#10ddbb", "#1752d3", "#b40bd6"]

        const major_scale = scale_from_str("_ _ __ _ _ _")
        const note_scale = this.scale_ens[this.scale_n]!.slice() as Arr12<boolean>
        note_scale.push(...note_scale.splice(0, (12 - this.scale_rotation) % 12))

        this.update_mouse()
        this.update_music(dt, note_scale)

        ctx.strokeStyle = PRIMARY_COLOR
        ctx.lineWidth = 1 / s
        ctx.fillStyle = PRIMARY_COLOR

        {
            const t0 = ctx.getTransform()

            // ----- KEYBOARD ----- //
            ctx.translate(-R / 2, -R / 2)
            ctx.strokeRect(0, 0, R, R)
            for (let i = 0; i < R; i++) {
                const is_white_key = major_scale[i % 12]
                const is_scale = note_scale[i % 12]
                ctx.strokeRect(i, -4, 1, 4)
                ctx.strokeRect(-4, R - i - 1, 4, 1)
                ctx.fillStyle = PRIMARY_COLOR
                if (is_white_key) {
                    ctx.fillRect(i, -4, 1, 4)
                    ctx.fillRect(-4, R - i - 1, 4, 1)
                }
                ctx.fillStyle = SECONDARY_COLOR
                if (is_scale) {
                    ctx.fillRect(i + 0.2, 0.2, 0.6, R - 0.4)
                    ctx.fillRect(0.2, R - i - 1 + 0.2, R - 0.4, 0.6)
                }
            }

            // ----- CHORD LINES ----- //
            const chord_i = this.chordnote_positions(note_scale)
            ctx.globalCompositeOperation = "lighten"
            for (let n = 0; n < 4; n++) {
                if (!this.chordnote_enabled[n]) continue
                ctx.fillStyle = NOTE_COLOR[n]!
                const i = chord_i[n]!
                const horiz = this.chordnote_horizontal[n]!
                if (horiz) {
                    ctx.fillRect(1 / s, R - i - 1, R - 2 / s, 1)
                } else {
                    ctx.fillRect(i, 1 / s, 1, R - 2 / s)
                }

            }
            ctx.globalCompositeOperation = "source-over"

            // ----- CURSOR POS ----- //
            ctx.strokeStyle = PRIMARY_COLOR
            ctx.lineWidth = 1 / s
            ctx.fillStyle = PRIMARY_COLOR
            // ctx.strokeRect(this.mouse_raw.x - 1, this.mouse_raw.y - 1, 2, 2)
            ctx.fillRect(this.mouse_key.x, R - this.mouse_key.y - 1, 1, 1)

            // ----- NOTE STATI ----- //
            for (let n = 0; n < 4; n++) {
                const en = this.chordnote_enabled[n]!
                const horiz = this.chordnote_horizontal[n]!
                const off = this.chordnote_offsets[n]!
                const NOTE_PRIMARY_COLOR = NOTE_COLOR[n]!
                const NOTE_SECONDARY_COLOR = "#000000"

                const y = 6 * n

                ctx.strokeStyle = NOTE_PRIMARY_COLOR
                ctx.fillStyle = NOTE_PRIMARY_COLOR
                ctx.strokeRect(-20, y, 4, 4)
                if (this.number_held === n) {
                    ctx.strokeRect(-21, y - 1, 16, 6)
                }
                if (en) {
                    ctx.fillRect(-20, y, 4, 4)
                }
                ctx.fillStyle = en ? NOTE_SECONDARY_COLOR : NOTE_PRIMARY_COLOR
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.font = "3px Ubuntu Mono"
                ctx.fillText((n + 1).toString(), -18, y + 2)
                ctx.fillStyle = NOTE_PRIMARY_COLOR
                ctx.textAlign = "left"
                ctx.fillText((horiz ? "- " : "| ") + ((off > 0 ? "+" : off < 0 ? "-" : " ") + Math.abs(off)), -15, y + 2)
            }
            // ----- MISC STATUS ----- //

            ctx.fillStyle = "#ffffff"
            ctx.strokeStyle = "#ffffff"
            ctx.textAlign = "left"
            ctx.textBaseline = "middle"
            ctx.font = "3px Ubuntu Mono"

            ctx.fillText(this.note_names[this.scale_rotation]?.padEnd(2, " ") + " " + this.scale_names[this.scale_n], -20, 26)
            ctx.strokeRect(-21, 24, 16, 4)

            // ctx.textAlign = "center"
            if (this.strum) {
                ctx.fillRect(-21, 34.5, 16, 3)
            }
            ctx.fillStyle = this.strum ? "#000000" : "#ffffff"
            ctx.fillText("STRUM: " + (this.strum ? "ON" : "--"), -20, 36)

            for (let i = 0; i < this.chord_pattern.length; i++) {
                const color = (Math.floor(this.step_i / 4 + 6) % this.chord_pattern.length === i) && this.playing ? NOTE_COLOR[this.number_held]! : "#ffffff"
                ctx.fillStyle = color
                ctx.strokeStyle = color
                ctx.strokeRect(-20 + i * 2 * 14 / 15, 30, 1, 4)
                if (this.chord_pattern[i]) {
                    ctx.fillRect(-20 + i * 2 * 14 / 15, 30, 1, 4)
                }
            }


            ctx.textAlign = "left"
            ctx.textBaseline = "top"
            ctx.fillStyle = PRIMARY_COLOR
            ctx.fillText((this.playing ? "PLAYING " : "PAUSED  ") + "[click to toggle]", -4, R)


            ctx.setTransform(t0)
        }

    }
}

type Arr12<T> = [T, T, T, T, T, T, T, T, T, T, T, T]
function scale_from_str(s: string): Arr12<boolean> {
    const v = s.split("").map(ch => ch !== " ")
    if (v.length != 12) {
        throw new Error("scales must have twelve notes because we 12 edo today")
    }
    return v as Arr12<boolean>
}
function gen_scale_mappings(scale_en: boolean[]): Arr12<number> {
    const scale_map = new Array(12).fill(0) as Arr12<number>
    let last_valid = 0
    for (let i = 0; i < 24; i++) {
        if (i == 12) {
            last_valid -= 12
        }
        if (scale_en[i % 12]) {
            last_valid = i % 12
        }
        scale_map[i % 12] = last_valid
    }
    return scale_map
}
function apply_scale_remap(note: number, scale: Arr12<number>) {
    const i = (note % 12 + 12) % 12
    return note - i + scale[i]!
}

export function MusicMouse() {
    const handler = useMemo(() => new MusicMouseHandler(), [])
    return (<CanvasEngine>
        {[
            ({ ctx, cnv: { width, height } }) => {
                ctx.fillStyle = "#777"
                ctx.font = "20px monospace"
                ctx.textAlign = "right"
                ctx.textBaseline = "top"
                ctx.fillText("musicmouse_web_clone", width - 10, 10)
                ctx.textBaseline = "bottom"
                ctx.font = "10px monospace"
                ctx.fillText("https://github.com/SciDev5/musicmouse_web_clone", width - 10, height - 10)
            },
            handler,
        ]}
    </CanvasEngine>);
}
