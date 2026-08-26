import { ImageResponse } from "next/og";
import { createElement } from "react";

export function createPingPwaIcon(size: number) {
  const markSize = Math.round(size * 0.68);
  const radius = Math.round(size * 0.18);

  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#59d951",
        },
      },
      createElement(
        "div",
        {
          style: {
            width: markSize,
            height: markSize,
            borderRadius: radius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#17351b",
            color: "#ffffff",
            fontSize: Math.round(size * 0.38),
            fontWeight: 900,
            letterSpacing: Math.round(size * -0.02),
          },
        },
        "p.",
      ),
    ),
    { width: size, height: size },
  );
}
