import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "江湖夜雨十年灯",
    short_name: "江湖夜雨十年灯",
    description: "任务、阶段、恒力和成长系统一体化的自我提升面板。",
    start_url: "/",
    display: "standalone",
    background_color: "#07131f",
    theme_color: "#07131f",
    lang: "zh-CN",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
