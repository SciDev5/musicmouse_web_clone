export class SimpleVoice implements Voice {
    readonly id = Math.random().toString(36).substring(2, 6)
    constructor(
        actx: BaseAudioContext,
        dest: AudioNode,
        // readonly osc = new OscillatorNode(actx, { type: "triangle" }),
        readonly osc = new OscillatorNode(actx, { type: "sawtooth" }),
        // readonly osc = new OscillatorNode(actx, { type: "sine" }),
        readonly gain = new GainNode(actx, { gain: 0 }),
    ) {
        osc.start()
        osc.connect(gain).connect(dest)
    }
    t_down: number = -Infinity
    t_up?: number = -Infinity
    down(at: number, freq: number, velocity: number): void {
        // console.log("down", this.id);

        this.t_down = at
        delete this.t_up

        this.gain.gain.cancelScheduledValues(at)
        // this.gain.gain.setValueAtTime(1, at)
        this.gain.gain.setValueAtTime(0, at)
        this.gain.gain.linearRampToValueAtTime(1, at + 0.01)
        this.gain.gain.exponentialRampToValueAtTime(0.3, at + 0.1)
        this.osc.frequency.setValueAtTime(freq, at)
    }
    up(at: number): void {
        this.t_up = at

        this.gain.gain.cancelScheduledValues(at)
        // this.gain.gain.setValueAtTime(actx.currentTime, 0)
        this.gain.gain.linearRampToValueAtTime(0.0, at + 2.5)
        // this.gain.gain.linearRampToValueAtTime(0.0, at + 5.5)
    }
    cut(): void {
        const actx = this.gain.context
        this.gain.gain.cancelScheduledValues(actx.currentTime)
        this.gain.gain.setValueAtTime(actx.currentTime, 0)
        this.osc.frequency.cancelScheduledValues(actx.currentTime)
    }
    reuse_priority(at: number): number {
        const is_up = this.t_up != null && at >= this.t_up
        return (is_up ? 2 - Math.exp(this.t_up! - at) : 1 - Math.exp(this.t_down - at))
    }
}
interface Voice {
    down(at: number, freq: number, velocity: number): void
    up(at: number): void
    cut(): void
    reuse_priority(at: number): number
}

export class Synth {
    constructor(
        readonly actx: BaseAudioContext = new AudioContext(),
        readonly mix_gain = new GainNode(actx, { gain: 0.5 }),
        readonly delay = new DelayNode(actx, { delayTime: 0.375 }),
        readonly delay_feedback = new GainNode(actx, { gain: 0.75 }),
        // readonly delay_feedback = new GainNode(actx, { gain: 0.0 }),
        readonly verb = new ConvolverNode(actx, {
            buffer: (() => {
                const b = actx.createBuffer(2, 1024 * 64, actx.sampleRate)
                for (let ch = 0; ch < b.numberOfChannels; ch++) {
                    const d = b.getChannelData(ch)
                    for (let i = 0; i < d.length; i++) {
                        d[i] = (Math.random() - 0.5) * 4 * Math.exp(-i / d.length * 10)
                    }
                    d[0] = 50
                }
                return b
            })()
        })
    ) {
        mix_gain.connect(delay).connect(verb).connect(actx.destination)
        // verb.connect(delay_feedback)
        delay.connect(delay_feedback).connect(delay)
    }

    add_voices(new_voice: (actx: BaseAudioContext, dest: AudioNode) => Voice, n: number) {
        for (let i = 0; i < n; i++) {
            this.voices.push(new_voice(this.actx, this.mix_gain))
        }
    }

    readonly voices: Voice[] = []

    select_voice(at: number): Voice | null {
        return this.voices.map(v => ({ v, p: v.reuse_priority(at) })).sort(({ p: p_a }, { p: p_b }) => p_b - p_a)[0]?.v ?? null
    }

    play(freq: number, at: number, vel: number) {
        const v = this.select_voice(at)
        if (v == null) throw new Error("add voices or else")

        v.down(at, freq, vel)
        return (at: number) => v.up(at)
    }
}

export class NoteQueue {
    readonly notes: { on: number, freq: number, off: number, vel: number }[] = []
    constructor() { }
    private id = 0
    unbind() {
        clearInterval(this.id)
    }
    bind(synth: Synth) {
        this.unbind()
        this.id = setInterval(() => {
            const nao = synth.actx.currentTime
            this.notes.sort(({ on: on_a }, { on: on_b }) => on_b - on_a)
            for (let i = this.notes.length - 1; i >= 0; i--) {
                if (this.notes[i]!.on > nao + 0.02) break
                const v = this.notes[i]!
                synth.play(v.freq, v.on, v.vel)(v.off)
                this.notes.pop()
            }
        }, 10) as never as number
    }
}