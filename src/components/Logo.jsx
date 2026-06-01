/**
 * Logo — the Vizora brand mark. Renders the SVG from /public at any size.
 * Never distorts: width === height, object-fit contain.
 */
import { LOGO_SRC, APP_NAME } from "../branding";

export default function Logo({ size = 32, className = "", style = {} }) {
  return (
    <img
      src={LOGO_SRC}
      alt={APP_NAME}
      width={size}
      height={size}
      className={className}
      style={{ display: "block", objectFit: "contain", width: size, height: size, ...style }}
      draggable={false}
    />
  );
}
