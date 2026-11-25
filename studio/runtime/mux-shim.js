// Thin wrapper so export.js does not depend on a specific muxer API surface.
export const Muxer = {
  async create({ kind, canvas, fps, durationMs, audioBuffer }) {
    const mb = await import("mediabunny");
    const target = new mb.BufferTarget();
    const format = kind === "mp4" ? new mb.Mp4OutputFormat() : new mb.WebMOutputFormat();
    const output = new mb.Output({ format, target });
    const video = new mb.CanvasSource(canvas, {
      codec: kind === "mp4" ? "avc" : "vp9",
      bitrate: mb.QUALITY_HIGH ?? 8_000_000,
    });
    output.addVideoTrack(video, { frameRate: fps });
    let audio = null;
    if (audioBuffer) {
      audio = new mb.AudioBufferSource({ codec: kind === "mp4" ? "aac" : "opus", bitrate: 192_000 });
      output.addAudioTrack(audio);
    }
    await output.start();
    if (audio) await audio.add(audioBuffer);
    return {
      addVideoFrame: (timestamp, duration) => video.add(timestamp, duration),
      async finish() {
        await output.finalize();
        return new Blob([target.buffer], { type: kind === "mp4" ? "video/mp4" : "video/webm" });
      },
    };
  },
};
