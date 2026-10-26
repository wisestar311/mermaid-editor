// SVG and PNG output for the rendered diagram, shared by Export, Save As and Share.
export const FONT_AWESOME_URL = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css";

export type ImageSize = { mode: "auto" | "width" | "height"; value: number };

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Standalone SVG document text, with the page background and the Font Awesome stylesheet for `fa:` icons. */
export function svgMarkup(svg: SVGSVGElement, background: string, width?: number, height?: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  if (height) clone.setAttribute("height", `${height}px`);
  if (width) clone.setAttribute("width", `${width}px`);
  clone.style.backgroundColor = background;
  const markup = clone.outerHTML
    .replaceAll("<br>", "<br/>")
    .replaceAll(/<img([^>]*)>/g, (_match, attributes: string) => `<img ${attributes} />`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet href="${FONT_AWESOME_URL}" type="text/css"?>
${markup}`;
}

export function svgToBase64(svg: SVGSVGElement, background: string, width?: number, height?: number) {
  return toBase64(svgMarkup(svg, background, width, height));
}

/** Draws the diagram onto a canvas: twice its natural size by default, or a fixed width or height. */
export function rasterize(svg: SVGSVGElement, background: string, size: ImageSize = { mode: "auto", value: 0 }) {
  const box = svg.getBoundingClientRect();
  const viewBox = svg.viewBox?.baseVal;
  const contentWidth = viewBox && viewBox.width > 0 ? viewBox.width : box.width;
  const contentHeight = viewBox && viewBox.height > 0 ? viewBox.height : box.height;
  const canvas = document.createElement("canvas");
  if (size.mode === "width") {
    canvas.width = size.value;
    canvas.height = size.value * (contentHeight / contentWidth);
  } else if (size.mode === "height") {
    canvas.width = size.value * (contentWidth / contentHeight);
    canvas.height = size.value;
  } else {
    canvas.width = contentWidth * 2;
    canvas.height = contentHeight * 2;
  }
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("캔버스를 만들 수 없습니다"));
      return;
    }
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const image = new Image();
    image.addEventListener("load", () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    });
    image.addEventListener("error", () => reject(new Error("이미지를 그리지 못했습니다")));
    image.src = `data:image/svg+xml;base64,${svgToBase64(svg, background, canvas.width, canvas.height)}`;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG를 만들지 못했습니다"))), "image/png");
  });
}

/** Runs `run` on the diagram SVG with pan/zoom turned off, so its transform is not baked into the output. */
export type WithCleanSvg = <T>(run: (svg: SVGSVGElement, background: string) => Promise<T>) => Promise<T>;

export type DiagramExporter = (format: "svg" | "png") => Promise<Blob>;

export function createExporter(withCleanSvg: WithCleanSvg): DiagramExporter {
  return (format) =>
    withCleanSvg(async (svg, background) =>
      format === "svg"
        ? new Blob([svgMarkup(svg, background)], { type: "image/svg+xml" })
        : canvasToBlob(await rasterize(svg, background)),
    );
}
