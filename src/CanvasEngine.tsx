"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

export interface FrameData {
    ctx: CanvasRenderingContext2D,
    cnv: HTMLCanvasElement,
    t: number,
    dt: number,
}

export type FrameHandlerFn = ((data: FrameData) => void)
export interface FrameHandlerObject {
    draw: FrameHandlerFn
    init?: (cnv: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void
    destroy?: (cnv: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void
}
export type FrameHandler = FrameHandlerObject | FrameHandlerFn

export function CanvasEngine({
    children
}: {
    children: FrameHandler[]
}) {
    const [size_str, set_size_str] = useState("")
    const canvas_ref = useRef<HTMLCanvasElement>(null)
    const frame_arr: FrameHandler[] = useMemo(() => [], [])
    useEffect(() => {
        frame_arr.splice(0, frame_arr.length, ...children)
    }, [frame_arr, children])
    useEffect(() => {
        const cnv = canvas_ref.current!
        cnv.width = window.innerWidth
        cnv.height = window.innerHeight
        const ctx = cnv.getContext("2d")!
        let t_prev = 0
        let prev = new Set<FrameHandler>()
        const frame_fn = (t: number) => {
            t /= 1000
            frame_id = requestAnimationFrame(frame_fn)

            ctx.resetTransform()
            ctx.clearRect(0, 0, cnv.width, cnv.height)
            const v: FrameData = {
                cnv,
                ctx,
                t,
                dt: t - t_prev,
            }
            t_prev = t
            const current = new Set(frame_arr)
            for (const f_old of prev.difference(current)) {
                if (!(f_old instanceof Function))
                    f_old.destroy?.(cnv, ctx)
            }
            for (const f_new of current.difference(prev)) {
                if (!(f_new instanceof Function))
                    f_new.init?.(cnv, ctx)
            }
            prev = current
            for (const f of frame_arr) {
                ctx.resetTransform()
                if (f instanceof Function) {
                    f(v)
                } else {
                    f.draw(v)
                }
            }
        }
        let frame_id = requestAnimationFrame((t) => {
            t_prev = t / 1000
            frame_id = requestAnimationFrame(frame_fn)
        })
        return () => cancelAnimationFrame(frame_id)
    }, [frame_arr, size_str])
    useEffect(() => {
        addEventListener("resize", () => {
            set_size_str(window.innerWidth + "x" + window.innerHeight)
        })
    }, [])

    return <canvas ref={canvas_ref} />
}