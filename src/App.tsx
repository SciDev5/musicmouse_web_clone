
import { MusicMouse } from "./MusicMouse"


export default function App() {
    return (
        <main>
            <div
                // style={{ position: "absolute", top: "calc(max(0px, 50vh - min(100vw, 130vh) * 0.355 - 90px))", width: "100%", textAlign: "center", opacity: 0.2 }}
                style={{ position: "absolute", height: "100vh", width: "100vw", marginInline: "5%", display: "flex", flexDirection: "column", textAlign: "center", mixBlendMode: "soft-light" }}
            >
                <div style={{ flex: "1.5 1" }} />
                <img src={"./textlogo.png"} style={{
                    width: "90%",
                    // background: "#000",
                    opacity: 0.4,
                    // filter: "blur(0.5em)",
                    // imageRendering: "pixelated",
                }} />
                <div style={{ flex: "1 1" }} />
            </div>
            <MusicMouse />
        </main>
    );
}