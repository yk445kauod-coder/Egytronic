// Thin wrapper so export.js does not depend on a specific muxer API surface.
export const Muxer = {
  async create({ kind, canvas, fps, durationMs, audioBuffer }) {
    const mb = await import("mediabunny");
    const target = new mb.BufferTarget();
    const format = kind === "mp4" ? new mb.Mp4OutputFormat() : new mb.WebMOutputFormat();
    const output = new mb.Output({ format, target });
    // VideoSampleSource over an explicit ImageBitmap snapshot: CanvasSource/VideoFrame(canvas)
    // can encode a GPU texture that has already been repainted, blending two frames together.
    const video = new mb.VideoSampleSource({
      codec: kind === "mp4" ? "avc" : "vp9",
      bitrate: mb.QUALITY_HIGH ?? 8_000_000,
    });
    output.addVideoTrack(video, { frameRate: fps });
    const held = [];
    let audio = null;
    if (audioBuffer) {
      audio = new mb.AudioBufferSource({ codec: kind === "mp4" ? "aac" : "opus", bitrate: 192_000 });
      output.addAudioTrack(audio);
    }
    await output.start();
    if (audio) await audio.add(audioBuffer);
    return {
      async addVideoFrame(timestamp, duration, source = canvas) {
        const ctx = source.getContext("2d", { willReadFrequently: true });
        const frame = ctx.getImageData(0, 0, source.width, source.height);
        const sample = new mb.VideoSample(new Uint8Array(frame.data.buffer), {
          format: "RGBA",
          codedWidth: frame.width,
          codedHeight: frame.height,
          timestamp,
          duration,
        });
        held.push(sample);
        await video.add(sample);
      },
      async finish() {
        await output.finalize();
        for (const sample of held) sample.close();
        const blob = new Blob([target.buffer], { type: kind === "mp4" ? "video/mp4" : "video/webm" });
        return blob;
      },
    };
  },
};
