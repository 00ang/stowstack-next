"use client";

import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "@/components/design/dl003/dl003.css";
import { LevelTile, SkyBand } from "@/components/design/dl003/ui";

const manrope = Manrope({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-manrope",
});

const plex = IBM_Plex_Mono({
  weight: ["600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

/**
 * Side-by-side of the three sky placements, plus where a dither plate
 * must not sit. Static mock beside the sample portal.
 */
export default function Dl003Board() {
  return (
    <div className={`${manrope.variable} ${plex.variable} d3-board`} style={{ fontFamily: "var(--font-manrope), Manrope, system-ui, sans-serif" }}>
      <div className="d3-kicker">003 mock · not a ship · sample facility only</div>
      <h1>Where the sky should sit</h1>
      <p className="d3-lead" style={{ maxWidth: 640 }}>
        One sky plate per page. Words stay in a white pane. The recommendation is the hero band on Campaign Builder, a thin strip on the other tabs, and no sky under a table.
      </p>

      <div className="d3-cols">
        <div className="d3-col">
          <SkyBand variant="hero" short label="003 · full band" />
          <div className="d3-fake-toolbar">Campaign · Fall Move Season</div>
          <div style={{ padding: 10 }}>
            <div className="d3-kicker">Nodes stay on white, under the band</div>
            <p className="d3-rec">Use this on the builder.</p>
          </div>
        </div>
        <div className="d3-col">
          <SkyBand variant="strip" label="003 · thin strip" />
          <div className="d3-fake-toolbar">Index · Tools · ledger header</div>
          <div style={{ padding: 10 }}>
            <div className="d3-kicker">A weather line, then the instrument</div>
            <p className="d3-rec">Use this on Index, Tools, and the page editor.</p>
          </div>
        </div>
        <div className="d3-col" style={{ background: "#fff" }}>
          <div style={{ padding: 10 }}>
            <div className="d3-kicker">003 · empty state only</div>
          </div>
          <div style={{ margin: "0 12px", border: "1px solid #121214" }}>
            <SkyBand variant="strip" label="003 · sky inside the empty card" />
            <div className="d3-empty" style={{ margin: 0, border: 0 }}>
              <div className="d3-kicker">Empty campaign</div>
              <h3>No path on the canvas yet.</h3>
              <p className="d3-lead">Drag a function in, or build from the month’s goal. Nothing spends from an empty draft.</p>
            </div>
          </div>
          <p className="d3-rec" style={{ padding: "8px 10px 12px" }}>
            Sky only when the canvas is empty. Once nodes are on it, move the sky up to the band.
          </p>
        </div>
      </div>

      <p className="d3-rec">Recommendation: hero band on the builder. Thin strip everywhere else. Empty-state sky only while the canvas is blank.</p>

      <h2 className="d3-display" style={{ marginTop: 28, fontSize: 24 }}>
        Do not put the sky under a table
      </h2>
      <div className="d3-dont">
        <div className="d3-col d3-bad">
          <div className="d3-x">003 · don’t · text on the dots</div>
          <table className="d3-table">
            <thead>
              <tr>
                <th>Move-in</th>
                <th>Unit</th>
                <th>How we know</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sample row</td>
                <td>10×10</td>
                <td>You marked it</td>
              </tr>
              <tr>
                <td>Sample row</td>
                <td>10×20</td>
                <td>Phone, exact</td>
              </tr>
              <tr>
                <td>Sample row</td>
                <td>5×5</td>
                <td>Not asked yet</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="d3-col">
          <div className="d3-kicker" style={{ padding: 8 }}>
            003 · do · white table, sky elsewhere
          </div>
          <table className="d3-table">
            <thead>
              <tr>
                <th>Move-in</th>
                <th>Unit</th>
                <th>How we know</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sample row</td>
                <td>10×10</td>
                <td>You marked it</td>
              </tr>
              <tr>
                <td>Sample row</td>
                <td>10×20</td>
                <td>Phone, exact</td>
              </tr>
              <tr>
                <td>Sample row</td>
                <td>5×5</td>
                <td>Not asked yet</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="d3-display" style={{ marginTop: 28, fontSize: 24 }}>
        Level tints
      </h2>
      <p className="d3-lead">Gain is 90% and up. The middle tint is a normal fill. Pink is only under 60%, and only when the number is real.</p>
      <div className="d3-levels" style={{ maxWidth: 520, marginTop: 10 }}>
        <LevelTile label="10×30 · sample" filled={12} total={12} />
        <LevelTile label="10×10 · sample" filled={62} total={80} />
        <LevelTile label="tint key · not a unit" filled={4} total={10} note="tint only" />
      </div>
    </div>
  );
}
